import { describe, expect, it } from "vitest";
import { classic } from "../../src/core/classic";

const play = (cells: number[]) => cells.reduce(classic.apply, classic.init());

describe("Classic (GDD §3.1)", () => {
  it("R3: three in a row wins and reports the line", () => {
    const s = play([0, 3, 1, 4, 2]);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [0, 1, 2] });
  });

  it("R4: a full board with no line is a draw", () => {
    expect(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).result).toEqual({
      kind: "draw",
      reason: "board-full",
    });
  });

  it("R2: an illegal move changes nothing", () => {
    const s = play([4]);
    expect(classic.apply(s, 4)).toBe(s);
    expect(classic.apply(s, 9)).toBe(s);
    expect(classic.apply(s, 1.5)).toBe(s);
  });

  it("R1/R8: the chosen side moves first and sides alternate", () => {
    const s = classic.init("O");
    expect(s.toMove).toBe("O");
    expect(classic.apply(s, 0).toMove).toBe("X");
  });

  it("R5: no moves after the game ends", () => {
    const s = play([0, 3, 1, 4, 2]);
    expect(classic.legalMoves(s)).toEqual([]);
    expect(classic.apply(s, 8)).toBe(s);
  });
});
