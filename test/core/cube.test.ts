import { describe, expect, it } from "vitest";
import type { ClassicState } from "../../src/core/classic";
import {
  CAP_LINES,
  CUBE_GROWN,
  CUBE_LINES,
  cube,
  cubeGrown,
  cubePlacedAt,
  cubePlayer,
} from "../../src/core/cube";
import { createRng } from "../../src/core/rng";

const play = (cells: number[], first: "X" | "O" = "X") =>
  cells.reduce(cube.apply, cube.init(first));
/** A cell by layer (from the bottom), row (from the back) and column, on 4×4×4 and 5×5×5. */
const at4 = (l: number, r: number, c: number) => (l * 4 + r) * 4 + c;
const at5 = (l: number, r: number, c: number) => (l * 5 + r) * 5 + c;

/** Seven marks and no line: X holds three of the bottom back row; X's 7th grows the cube. */
const SEVEN = [
  at4(0, 0, 0),
  at4(3, 3, 3),
  at4(0, 0, 1),
  at4(3, 3, 2),
  at4(0, 0, 2),
  at4(2, 1, 3),
  at4(1, 2, 0),
];

/**
 * A full 5×5×5 cube with no line of four, 63 X and 62 O, layer by layer from the bottom
 * (found by a local search, research TTT-4.1.12).
 */
const NO_LINE = [
  "OOOXXXOXOOXOXXOXXOXOOXOXX",
  "XOXOXXXXOXOOOXOOXOXXOXOXX",
  "XOXOOOOXXXXOXOOOXOOOOXXXO",
  "XXXOXXOOOXOXXOXOOXXOXOOOX",
  "OXOXOXOXXOOOXOXXOOXOXXOXO",
].join("");

describe("Cube (GDD §3.8)", () => {
  it("C1, C2: 64 cells; 76 lines of four in the 13 directions, and 302 on the 5×5×5 cube", () => {
    expect(cube.init().cells).toHaveLength(64);
    expect(CUBE_LINES).toHaveLength(76);
    expect(CAP_LINES).toHaveLength(302);
    const steps = new Set(CUBE_LINES.map(([a, b]) => (b as number) - (a as number)));
    expect(steps.size).toBe(13);
    expect(cube.apply(play([5]), 5)).toEqual(play([5])); // R2: a taken cell
  });

  it("C2: four on a space diagonal wins, and a win on the 7th mark ends the game unchanged", () => {
    const diagonal = [at4(0, 0, 0), at4(1, 1, 1), at4(2, 2, 2), at4(3, 3, 3)];
    const [a, b, c, d] = diagonal as [number, number, number, number];
    const s = play([a, 1, b, 2, c, 3, d]);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: diagonal });
    expect(s.cells).toHaveLength(64);
  });

  it("C3, C4: after the 7th mark the cube grows on the top, right and back, every mark in place, and the second player moves", () => {
    const before = play(SEVEN.slice(0, 6));
    const s = play(SEVEN);
    expect(cubeGrown(before)).toBe(false);
    expect(cubeGrown(s)).toBe(true);
    expect(s.result).toBeNull();
    expect(s.toMove).toBe("O");
    expect(play(SEVEN, "O").toMove).toBe("X");
    // A cell keeps its layer and column, one row further from the new back row.
    expect(CUBE_GROWN[at4(0, 0, 0)]).toBe(at5(0, 1, 0));
    expect(CUBE_GROWN[at4(3, 3, 3)]).toBe(at5(3, 4, 3));
    const seventh = SEVEN[6] as number;
    for (let i = 0; i < 64; i++)
      expect(s.cells[CUBE_GROWN[i] as number]).toBe(i === seventh ? "X" : before.cells[i]);
    expect(s.cells.filter((m) => m !== null)).toHaveLength(7);
    expect(cube.legalMoves(s)).toHaveLength(118);
    expect(cubePlacedAt(s, seventh)).toBe(CUBE_GROWN[seventh]);
    expect(cubePlacedAt(play([...SEVEN, 0]), 0)).toBe(0); // later moves are on the grown cube
  });

  it("C5: on the grown cube four in a line wins, also through the new cells", () => {
    // X's three on the bottom back row now sit in row 1; O's reply elsewhere, X completes it.
    expect(play([...SEVEN, at5(4, 0, 0)]).result).toBeNull();
    expect(play([...SEVEN, at5(4, 0, 0), at5(0, 1, 3)]).result).toEqual({
      kind: "win",
      winner: "X",
      line: [at5(0, 1, 0), at5(0, 1, 1), at5(0, 1, 2), at5(0, 1, 3)],
    });
    // O's pillar of four in the new right-back corner, up into the new top layer.
    const pillar = [at5(1, 0, 4), at5(2, 0, 4), at5(3, 0, 4), at5(4, 0, 4)];
    const [p, q, r, t] = pillar as [number, number, number, number];
    const s = play([...SEVEN, p, at5(0, 4, 0), q, at5(0, 4, 1), r, at5(2, 4, 2), t]);
    expect(s.result).toEqual({ kind: "win", winner: "O", line: pillar });
  });

  it("C5: the cube grows only once; a full 5×5×5 cube with no line is a draw", () => {
    expect(CAP_LINES.every((l) => new Set(l.map((i) => NO_LINE[i])).size > 1)).toBe(true);
    const last = NO_LINE.indexOf("X");
    const cells = [...NO_LINE].map((m, i) => (i === last ? null : m)) as ClassicState["cells"];
    const s = cube.apply({ cells, toMove: "X", moves: Array(124).fill(0), result: null }, last);
    expect(s.cells).toHaveLength(125);
    expect(s.result).toEqual({ kind: "draw", reason: "board-full" });
    expect(cube.legalMoves(s)).toEqual([]);
  });

  it("R7, C6: the record replays to the same position across the growth", () => {
    const moves = [...SEVEN, at5(4, 0, 0), at5(2, 2, 2)];
    const s = play(moves);
    expect(s.moves).toEqual(moves);
    expect(moves.reduce(cube.apply, cube.init("X"))).toEqual(s);
  });

  it("the computer takes a win before the growth and blocks one after it", () => {
    for (const level of ["casual", "keen", "sharp"] as const) {
      const p = cubePlayer(level, createRng(7));
      // X to move with three of the bottom back row.
      expect(p(play(SEVEN.slice(0, 6)))).toBe(at4(0, 0, 3));
      if (level !== "casual") expect(p(play(SEVEN))).toBe(at5(0, 1, 3)); // O blocks
    }
  });
});
