import { describe, expect, it } from "vitest";
import {
  deadBoard,
  grown,
  OVERTIME_CENTRE,
  overtime,
  overtimePlayer,
} from "../../src/core/overtime";
import { createRng } from "../../src/core/rng";

const play = (cells: number[], first: "X" | "O" = "X") =>
  cells.reduce(overtime.apply, overtime.init(first));

/** A Classic draw, X first, ending with X's ninth mark (the rule card's demo). */
const DRAW = [4, 0, 2, 6, 3, 5, 1, 7, 8];

describe("Overtime (GDD §3.8)", () => {
  it("O1: Classic on 3×3 until a draw; three in a row wins", () => {
    const s = play([0, 3, 1, 4, 2]);
    expect(s.cells).toHaveLength(9);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [0, 1, 2] });
    expect(overtime.apply(play([4]), 4)).toEqual(play([4])); // R2: a taken cell
  });

  it("O2, O3: a 3×3 draw grows the board to 5×5, every mark in the centre, and the other side moves", () => {
    const before = play(DRAW.slice(0, 8));
    const s = play(DRAW);
    expect(grown(before)).toBe(false);
    expect(grown(s)).toBe(true);
    expect(s.result).toBeNull();
    expect(s.toMove).toBe("O");
    expect(OVERTIME_CENTRE.map((c) => s.cells[c])).toEqual([...before.cells.slice(0, 8), "X"]);
    expect(s.cells.filter((m) => m !== null)).toHaveLength(9);
    expect(overtime.legalMoves(s)).toHaveLength(16); // only the ring
    expect(overtime.legalMoves(play(DRAW, "O")).length).toBe(16);
    expect(play(DRAW, "O").toMove).toBe("X");
  });

  it("O4: on the grown board four in a row wins, and three does not", () => {
    // O's centre marks 13 and 17 lie on the diagonal 9-13-17-21.
    expect(play([...DRAW, 9]).result).toBeNull();
    expect(play([...DRAW, 9, 3, 21]).result).toEqual({
      kind: "win",
      winner: "O",
      line: [9, 13, 17, 21],
    });
    // Three in a row on the ring's top edge is no win.
    expect(play([...DRAW, 0, 20, 1, 21, 2]).result).toBeNull();
  });

  it("O5: the grown board is a draw as soon as no line of four is open for either side", () => {
    // O takes 0 1 4 10 14 15 22 and X 2 3 5 9 19 20 21: after X's 21 every line of four
    // holds both marks, with cells 23 and 24 still empty (David, 2026-10-30, P27).
    const order = [0, 2, 1, 3, 4, 5, 10, 9, 14, 19, 15, 20, 22, 21];
    const before = play([...DRAW, ...order.slice(0, -1)]);
    expect(before.result).toBeNull();
    expect(deadBoard(before.cells)).toBe(false);
    const s = play([...DRAW, ...order]);
    expect(deadBoard(s.cells)).toBe(true);
    expect(s.result).toEqual({ kind: "draw", reason: "dead-board" });
    expect(s.cells.filter((m) => m === null)).toHaveLength(2);
    expect(overtime.legalMoves(s)).toEqual([]);
    expect(overtime.apply(s, 23)).toEqual(s);
  });

  it("R7: the record replays to the same position across the growth", () => {
    const moves = [...DRAW, 9, 3];
    const s = play(moves);
    expect(s.moves).toEqual(moves);
    expect(moves.reduce(overtime.apply, overtime.init("X"))).toEqual(s);
  });

  it("the computer plays Classic before the growth and searches the ring after it; it takes a ring win", () => {
    for (const level of ["casual", "keen", "sharp"] as const) {
      const p = overtimePlayer(level, createRng(7));
      expect(overtime.legalMoves(play([4, 0])).includes(p(play([4, 0])))).toBe(true);
      expect(p(play([...DRAW, 9, 3]))).toBe(21); // O completes the diagonal
    }
  });
});
