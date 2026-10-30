import { describe, expect, it } from "vitest";
import { classic } from "../../src/core/classic";
import { misereWild, wildMove } from "../../src/core/misere-wild";
import { solve } from "../../src/core/solver";

const X = (cell: number) => wildMove(cell, "X");
const O = (cell: number) => wildMove(cell, "O");
const play = (moves: number[], first: "X" | "O" = "X") =>
  moves.reduce(misereWild.apply, misereWild.init(first));

describe("Misère wild (GDD §3.8)", () => {
  it("W1: either side places either mark on an empty cell; a taken cell changes nothing", () => {
    const s = play([O(4), O(0)]);
    expect(s.cells[4]).toBe("O");
    expect(s.cells[0]).toBe("O");
    expect(s.toMove).toBe("X");
    expect(misereWild.legalMoves(s)).toHaveLength(14);
    expect(misereWild.apply(s, X(4))).toBe(s); // R2
    expect(misereWild.apply(s, 18)).toBe(s);
    expect(misereWild.key(s)).toBe(classic.key(s));
  });

  it("W2: three of one mark loses for whoever placed the third, whichever side began the line", () => {
    // Side X starts a line of O's; side O completes it and loses.
    const s = play([O(0), O(1), X(4), O(2)]);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [0, 1, 2] });
    expect(misereWild.legalMoves(s)).toEqual([]);
    expect(misereWild.apply(s, X(5))).toBe(s);
  });

  it("W3: a full board with no line is a draw", () => {
    const s = play([X(0), X(1), O(2), O(3), O(4), X(5), X(6), X(7), O(8)]);
    expect(s.result).toEqual({ kind: "draw", reason: "board-full" });
  });

  it("fairness: perfect play draws, and the centre, with either mark, is the only safe first move", () => {
    const sol = solve(misereWild, [misereWild.init("X"), misereWild.init("O")]);
    for (const first of ["X", "O"] as const) {
      const s0 = misereWild.init(first);
      expect(sol.value(s0).outcome).toBe("draw");
      const safe = misereWild
        .legalMoves(s0)
        .filter((m) => sol.value(misereWild.apply(s0, m)).outcome === "draw");
      expect(safe).toEqual([X(4), O(4)]);
    }
  });
});
