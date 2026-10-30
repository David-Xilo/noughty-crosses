import { describe, expect, it } from "vitest";
import { classic } from "../../src/core/classic";
import { misere } from "../../src/core/misere";
import { solve } from "../../src/core/solver";

const play = (cells: number[], first: "X" | "O" = "X") =>
  cells.reduce(misere.apply, misere.init(first));

describe("Misère (GDD §3.3)", () => {
  it("M2: completing three of your own in a row loses, and the line is reported", () => {
    const s = play([0, 3, 1, 4, 2]);
    expect(s.result).toEqual({ kind: "win", winner: "O", line: [0, 1, 2] });
    expect(misere.legalMoves(s)).toEqual([]);
    expect(misere.apply(s, 5)).toBe(s); // R2: no move after the end, and no new result
  });

  it("M3: a full board with no line is a draw", () => {
    expect(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).result).toEqual({
      kind: "draw",
      reason: "board-full",
    });
  });

  it("M1: the board and moves are Classic's; illegal moves change nothing", () => {
    const s = play([4], "O");
    expect(s.cells[4]).toBe("O");
    expect(s.toMove).toBe("X");
    expect(misere.apply(s, 4)).toBe(s);
    expect(misere.key(s)).toBe(classic.key(s));
  });

  it("fairness: perfect play draws, and the centre is the only first move that does not lose", () => {
    const sol = solve(misere, [misere.init("X"), misere.init("O")]);
    for (const first of ["X", "O"] as const) {
      const s0 = misere.init(first);
      expect(sol.value(s0).outcome).toBe("draw");
      const notLosing = misere
        .legalMoves(s0)
        .filter((m) => sol.value(misere.apply(s0, m)).outcome === "draw");
      expect(notLosing).toEqual([4]);
    }
  });
});
