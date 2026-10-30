import { describe, expect, it } from "vitest";
import { GRAVITY_LINES, gravity, landing } from "../../src/core/gravity";

// Cells are row-major, row 0 at the top: the bottom row is 30–35.
const play = (cells: number[], first: "X" | "O" = "X") =>
  cells.reduce(gravity.apply, gravity.init(first));

describe("Gravity (GDD §3.5)", () => {
  it("G1: a move lands on the lowest empty cell of its column; nothing else is legal", () => {
    const s = play([32, 26], "O");
    expect(s.cells).toHaveLength(36);
    expect(s.cells[32]).toBe("O");
    expect(s.cells[26]).toBe("X");
    expect(s.toMove).toBe("O");
    expect(gravity.legalMoves(s)).toEqual([30, 31, 20, 33, 34, 35]);
    expect(landing(s.cells, 2)).toBe(20); // any cell of the column names it
    expect(gravity.apply(s, 8)).toBe(s); // R2: a cell above an empty one
    expect(gravity.apply(s, 26)).toBe(s); // a taken cell
    expect(gravity.apply(s, 36)).toBe(s);
    const full = play([30, 24, 18, 12, 6, 0]);
    expect(landing(full.cells, 0)).toBeNull();
    expect(gravity.legalMoves(full)).not.toContain(0);
  });

  it("G2: four in a row wins, along a row, a column and both diagonals", () => {
    expect(play([30, 24, 31, 25, 32, 26, 33]).result).toEqual({
      kind: "win",
      winner: "X",
      line: [30, 31, 32, 33],
    });
    expect(play([35, 34, 29, 28, 23, 22, 17]).result).toMatchObject({ line: [17, 23, 29, 35] });
    expect(play([30, 31, 25, 32, 33, 26, 20, 27, 34, 21, 15]).result).toMatchObject({
      winner: "X",
      line: [15, 20, 25, 30],
    });
    expect(play([33, 32, 26, 31, 30, 25, 19, 24, 34, 18, 12]).result).toMatchObject({
      winner: "X",
      line: [12, 19, 26, 33],
    });
    expect(play([30, 24, 31, 25, 32]).result).toBeNull(); // three is not enough
  });

  it("G3: a full board with no four in a row is a draw", () => {
    const s = play([
      35, 33, 29, 31, 34, 25, 28, 22, 19, 13, 16, 23, 32, 10, 27, 4, 17, 11, 30, 5, 21, 26, 15, 20,
      7, 9, 3, 14, 24, 18, 1, 12, 8, 2, 6, 0,
    ]);
    expect(s.result).toEqual({ kind: "draw", reason: "board-full" });
    expect(gravity.legalMoves(s)).toEqual([]);
  });

  it("has 54 lines of four", () => {
    expect(GRAVITY_LINES).toHaveLength(54);
  });
});
