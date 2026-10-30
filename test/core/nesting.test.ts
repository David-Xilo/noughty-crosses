import { describe, expect, it } from "vitest";
import {
  createNesting,
  NEST_LEVELS,
  NESTING_RULES,
  nesting,
  nestingMove,
  nestSizes,
  nestTops,
  placeMove,
  reserveOf,
  shiftMove,
} from "../../src/core/nesting";
import { createRng } from "../../src/core/rng";

const play = (moves: number[], mode = nesting, first: "X" | "O" = "X") =>
  moves.reduce(mode.apply, mode.init(first));
const P = placeMove;
const M = shiftMove;
const [SMALL, MEDIUM, LARGE] = [0, 1, 2];

describe("Nesting (GDD §3.8)", () => {
  it("NE1: each side starts with two pieces of each size off the board", () => {
    const s = nesting.init("X");
    expect(nestTops(s)).toEqual(Array(9).fill(null));
    for (const z of [SMALL, MEDIUM, LARGE]) expect(reserveOf(s, "O", z)).toBe(2);
    // Every size on every cell: 27 placements and nothing to move.
    expect(nesting.legalMoves(s)).toHaveLength(27);
    const s2 = play([P(LARGE, 0), P(SMALL, 8), P(LARGE, 1), P(SMALL, 7)]);
    expect(reserveOf(s2, "X", LARGE)).toBe(0);
    expect(reserveOf(s2, "O", LARGE)).toBe(2);
    expect(nesting.apply(s2, P(LARGE, 2))).toBe(s2); // R2: no large left for X
  });

  it("NE2: a piece goes on an empty cell or over a smaller one; a side moves its own top piece", () => {
    const s = play([P(MEDIUM, 4)]);
    expect(nesting.apply(s, P(MEDIUM, 4))).toBe(s); // R2: not over the same size
    expect(nesting.apply(s, P(SMALL, 4))).toBe(s); // nor over a larger one
    const covered = nesting.apply(s, P(LARGE, 4)); // O covers X's medium
    expect(nestTops(covered)[4]).toBe("O");
    expect(nestSizes(covered)[4]).toBe(LARGE);
    // X's medium is under O's large: X cannot move it, nor move O's piece.
    expect(nesting.apply(covered, M(4, 0))).toBe(covered);
    const x = nesting.apply(covered, P(SMALL, 0));
    // O moves its large off: X's medium shows again.
    const moved = nesting.apply(x, M(4, 0));
    expect(nestTops(moved)).toEqual(["O", null, null, null, "X", null, null, null, null]);
    expect(nestSizes(moved)[4]).toBe(MEDIUM);
    expect(nesting.apply(moved, M(4, 4))).toBe(moved); // a move goes to another cell
  });

  it("NE3: three top pieces of one side in a row win, whatever is under them", () => {
    // X: large 0, medium 1 over O's small, small 2.
    const s = play([P(LARGE, 0), P(SMALL, 1), P(MEDIUM, 1), P(SMALL, 5), P(SMALL, 2)]);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [0, 1, 2] });
    expect(nesting.legalMoves(s)).toEqual([]);
  });

  it("NE4: uncovering the other side's line loses, unless the piece lands on that line", () => {
    // O: small 0, small 1, and a medium on 2 under X's large; X: small 7 and 8.
    const s = play([P(SMALL, 8), P(MEDIUM, 2), P(LARGE, 2), P(SMALL, 0), P(SMALL, 7), P(SMALL, 1)]);
    expect(s.result).toBeNull();
    expect(nesting.apply(s, M(2, 5)).result).toEqual({ kind: "win", winner: "O", line: [0, 1, 2] });
    // Landing on the line covers it again: the large takes O's small on 0.
    expect(nesting.apply(s, M(2, 0)).result).toBeNull();
    // Making the mover's own line does not help while the other side's shows.
    expect(nesting.apply(s, M(2, 6)).result).toEqual({ kind: "win", winner: "O", line: [0, 1, 2] });
  });

  it("NE5: the third occurrence of a position is a draw, and so is the 60th ply", () => {
    const setup = [P(LARGE, 0), P(LARGE, 8)];
    const loop = [M(0, 1), M(8, 7), M(1, 0), M(7, 8)];
    expect(play([...setup, ...loop]).result).toBeNull(); // the second occurrence
    expect(play([...setup, ...loop, ...loop]).result).toEqual({
      kind: "draw",
      reason: "repetition",
    });
    const long = createNesting({ ...NESTING_RULES, repetitionLimit: 99 });
    const moves = [...setup, ...Array.from({ length: 15 }, () => loop).flat()];
    const s = play(moves.slice(0, 60), long);
    expect(s.moves).toHaveLength(60);
    expect(s.result).toEqual({ kind: "draw", reason: "ply-cap" });
  });

  it("NE6: moves 0–26 place size × 9 + cell, 27–107 move from × 9 + to", () => {
    expect(P(SMALL, 0)).toBe(0);
    expect(P(LARGE, 8)).toBe(26);
    expect(M(0, 1)).toBe(28);
    expect(M(8, 7)).toBe(106);
    const s = play([P(LARGE, 4), P(MEDIUM, 0), M(4, 0)]);
    expect(nestTops(s)[0]).toBe("X");
    expect(nestTops(s)[4]).toBeNull();
  });

  it("the computer takes a win at every level, and a move whenever the game goes on", () => {
    // X to move with large 0 and large 1 on the board: a piece on 2 wins.
    const s = play([P(LARGE, 0), P(SMALL, 6), P(LARGE, 1), P(SMALL, 7)]);
    for (const level of ["casual", "keen", "sharp"] as const) {
      const move = nestingMove(s, { ...NEST_LEVELS[level], shortSight: 0 }, createRng(3));
      expect(nesting.apply(s, move).result).toMatchObject({ kind: "win", winner: "X" });
    }
  });
});
