import { describe, expect, it } from "vitest";
import { notakto, notaktoRank } from "../../src/core/notakto";
import { SOLVED_TABLES } from "../../src/core/solved-tables";
import { solve } from "../../src/core/solver";
import type { Side } from "../../src/core/types";
import { shippedTable } from "../support/tables";

const notaktoTable = shippedTable(SOLVED_TABLES.notakto);

const play = (cells: number[], boards = 1, first: Side = "X") =>
  cells.reduce(notakto.apply, notakto.init(first, boards));

describe("Notakto (GDD §3.7)", () => {
  it("N1: both sides place X, on one to three boards", () => {
    const s = play([4, 13, 22], 3);
    expect([s.cells[4], s.cells[13], s.cells[22]]).toEqual(["X", "X", "X"]);
    expect(s.toMove).toBe("O");
    expect(() => notakto.init("X", 4)).toThrow();
  });

  it("N2: three in a row kills a board, which takes no more marks", () => {
    const s = play([0, 9, 1, 10, 2], 2);
    expect(s.dead).toEqual([[0, 1, 2], null]);
    expect(s.result).toBeNull();
    expect(notakto.legalMoves(s).every((c) => c >= 9)).toBe(true);
    expect(notakto.apply(s, 5)).toBe(s); // R2
  });

  it("N3: whoever kills the last live board loses, and the line is reported", () => {
    const s = play([0, 9, 1, 10, 2, 11], 2);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [9, 10, 11] });
    expect(s.toMove).toBe("O"); // the side that made the line, and lost
    expect(notakto.legalMoves(s)).toEqual([]);
    expect(notakto.apply(s, 12)).toBe(s);
  });

  it("N4: every game ends with a winner, never a draw", () => {
    // A board holds at most six X without a line, so every game ends within 7 plies a board.
    const sol = solve(
      notakto,
      [1, 2, 3].map((n) => notakto.init("X", n)),
    );
    for (const n of [1, 2, 3]) expect(sol.value(notakto.init("X", n)).outcome).not.toBe("draw");
  });

  it("the position is the live boards up to symmetry and order", () => {
    const a = play([0, 13], 2); // a corner on board 1, the centre on board 2
    const b = play([4, 17], 2); // the centre on board 1, a corner on board 2
    expect(notakto.key(a)).toBe(notakto.key(b));
    expect(notaktoRank(a)).toBe(notaktoRank(b));
    // A dead board no longer counts: the rest is a one-board game.
    const c = play([0, 9, 1, 10, 2], 2);
    expect(notakto.key(c)).toBe(notakto.key(play([0, 1], 1, "O")));
  });

  it("fairness: odd board counts are first-player wins, even counts second-player wins", () => {
    for (const n of [1, 2, 3])
      for (const first of ["X", "O"] as const) {
        const want = n % 2 === 1 ? first : first === "X" ? "O" : "X";
        expect(notaktoTable.value(notakto.init(first, n)).outcome).toBe(want);
      }
  });

  it("fairness: on one board the centre is the only winning first move (Plambeck and Whitehead)", () => {
    expect(notaktoTable.bestMoves(notakto.init("X", 1))).toEqual([4]);
  });
});
