import { describe, expect, it } from "vitest";
import {
  fiveLeft,
  OC_LEVELS,
  OC_LINES,
  ocMove,
  orderChaos,
  orderChaosMove,
} from "../../src/core/order-chaos";
import { createRng } from "../../src/core/rng";

const X = (cell: number) => ocMove(cell, "X");
const O = (cell: number) => ocMove(cell, "O");
const play = (moves: number[], first: "X" | "O" = "X") =>
  moves.reduce(orderChaos.apply, orderChaos.init(first));

describe("Order and Chaos (GDD §3.8)", () => {
  it("OC1, OC4: the first side is Order; either side places either mark on an empty cell", () => {
    expect(OC_LINES).toHaveLength(32);
    const s = play([O(14), O(15)], "O");
    expect(s.order).toBe("O");
    expect(s.cells[14]).toBe("O");
    expect(s.cells[15]).toBe("O");
    expect(s.toMove).toBe("O");
    expect(orderChaos.legalMoves(s)).toHaveLength(68);
    expect(orderChaos.apply(s, X(14))).toBe(s); // R2
    expect(orderChaos.apply(s, 72)).toBe(s);
  });

  it("OC2: five of one mark wins for Order, whoever placed it; six in a row counts", () => {
    // Chaos completes Order's row of O's.
    const s = play([O(12), X(0), O(13), X(1), O(14), X(3), O(15), O(16)]);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [12, 13, 14, 15, 16] });
    expect(orderChaos.legalMoves(s)).toEqual([]);
    // A gap filled between two and three marks makes six.
    const six = play([X(12), O(0), X(13), O(7), X(15), O(2), X(16), O(9), X(17), O(4), X(14)]);
    expect(six.result).toMatchObject({ kind: "win", winner: "X" });
  });

  it("OC3: Chaos wins once every line of five holds both marks, before the board is full", () => {
    // A real game: Casual Order against Sharp Chaos.
    const moves = [14, 53, 26, 44, 28, 57, 27, 61, 56, 19, 51, 10, 4, 29, 16, 58, 9, 60, 1, 38];
    const before = play([...moves, 42, 18, 33]);
    expect(before.result).toBeNull();
    expect(fiveLeft(before.cells)).toBe(true);
    const s = orderChaos.apply(before, 68);
    expect(s.result).toEqual({ kind: "win", winner: "O", line: [] });
    expect(fiveLeft(s.cells)).toBe(false);
    expect(s.cells.filter((c) => c === null)).toHaveLength(12);
  });

  it("the computer: Order completes a five; Chaos blocks a four with the other mark", () => {
    const rng = createRng(1);
    const four = play([X(0), O(20), X(1), O(21), X(2), O(22), X(3)]);
    expect(four.toMove).toBe("O"); // Chaos
    expect(orderChaosMove(four.cells, false, OC_LEVELS.sharp, rng)).toBe(O(4));
    const open = play([X(0), O(20), X(1), O(21), X(2), O(22), X(3), X(35)]);
    expect(orderChaosMove(open.cells, true, OC_LEVELS.sharp, rng)).toBe(X(4));
    // The rule card's demo: three X down the middle of a column with both ends open. Every
    // level that looks two moves ahead blocks inside the line, where both fives need a cell.
    const three = play([14, 49, 20, 57, 8]);
    for (const level of ["keen", "sharp"] as const)
      expect(orderChaosMove(three.cells, false, OC_LEVELS[level], createRng(2))).toBe(O(26));
  });
});
