import { describe, expect, it } from "vitest";
import { BIG_LINES, bigBoard } from "../../src/core/bigboard";
import { LINES_3x3, linesOf } from "../../src/core/types";

const play = (cells: number[], first: "X" | "O" = "X") =>
  cells.reduce(bigBoard.apply, bigBoard.init(first));

describe("Big board (GDD §3.4)", () => {
  it("B1: a 5×5 board; sides alternate; illegal moves change nothing", () => {
    const s = play([12], "O");
    expect(s.cells).toHaveLength(25);
    expect(s.cells[12]).toBe("O");
    expect(s.toMove).toBe("X");
    expect(bigBoard.apply(s, 12)).toBe(s); // R2
    expect(bigBoard.apply(s, 25)).toBe(s);
  });

  it("B2: four in a row wins, along a row, a column and both diagonals", () => {
    expect(play([0, 5, 1, 6, 2, 7, 3]).result).toEqual({
      kind: "win",
      winner: "X",
      line: [0, 1, 2, 3],
    });
    expect(play([4, 0, 9, 1, 14, 2, 19]).result).toMatchObject({ line: [4, 9, 14, 19] });
    expect(play([1, 0, 7, 5, 13, 10, 19]).result).toMatchObject({ line: [1, 7, 13, 19] });
    expect(play([4, 0, 8, 1, 12, 2, 16]).result).toMatchObject({ line: [4, 8, 12, 16] });
    expect(play([0, 5, 1, 6, 2]).result).toBeNull(); // three is not enough
    expect(play([0, 5, 1, 6, 2, 7, 3]).toMove).toBe("X"); // the winner stays the last mover
  });

  it("B3: a full board with no four in a row is a draw", () => {
    const moves = [12, 8, 6, 18, 13, 11, 17, 7, 3, 9, 14, 4, 15, 1, 24, 2, 20, 5, 21, 22, 10];
    const s = play([...moves, 19, 23, 0, 16]);
    expect(s.result).toEqual({ kind: "draw", reason: "board-full" });
    expect(bigBoard.legalMoves(s)).toEqual([]);
  });

  it("has 28 lines of four; the same helper gives Classic's eight lines of three", () => {
    expect(BIG_LINES).toHaveLength(28);
    const key = (ls: ReadonlyArray<readonly number[]>) => ls.map((l) => l.join()).sort();
    expect(key(linesOf(3, 3, 3))).toEqual(key(LINES_3x3));
  });
});
