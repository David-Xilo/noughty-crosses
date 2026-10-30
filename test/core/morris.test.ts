import { describe, expect, it } from "vitest";
import {
  createMorris,
  MORRIS_RULES,
  morris,
  NEIGHBOURS,
  pureMorris,
  slideMove,
} from "../../src/core/morris";
import { solve } from "../../src/core/solver";

const play = (moves: number[], mode = morris, first: "X" | "O" = "X") =>
  moves.reduce(mode.apply, mode.init(first));
const S = slideMove;

describe("Three men's morris (GDD §3.8)", () => {
  it("TM1: each side places three pieces on empty cells; the first may not go in the centre", () => {
    const s0 = morris.init("X");
    expect(morris.legalMoves(s0)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(morris.apply(s0, 4)).toBe(s0); // R2
    const s = play([0, 4]); // the centre is open from the second move on
    expect(s.cells[4]).toBe("O");
    expect(morris.apply(s, 4)).toBe(s);
  });

  it("TM2: with three pieces down, a side slides one to a neighbouring empty cell along a line", () => {
    expect(NEIGHBOURS[0]).toEqual([1, 3, 4]);
    expect(NEIGHBOURS[1]).toEqual([0, 2, 4]);
    expect(NEIGHBOURS[4]).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    // X: 0, 3, 7; O: 8, 6, 5. X slides 3 to 4.
    const s = play([0, 8, 3, 6, 7, 5]);
    expect(morris.legalMoves(s)).toEqual([S(0, 1), S(0, 4), S(3, 4), S(7, 4)]);
    expect(morris.apply(s, 1)).toBe(s); // no fourth piece
    expect(morris.apply(s, S(0, 2))).toBe(s); // not a neighbour
    const after = morris.apply(s, S(3, 4));
    expect(after.cells[3]).toBeNull();
    expect(after.cells[4]).toBe("X");
    expect(after.toMove).toBe("O");
  });

  it("TM3: three of your own in a row wins, by a placement or by a slide", () => {
    expect(play([0, 4, 1, 3, 2]).result).toEqual({ kind: "win", winner: "X", line: [0, 1, 2] });
    // The rule card's demo: X slides 0 to 1 and completes the middle column.
    const s = play([0, 8, 3, 6, 7, 5, S(3, 4), S(5, 2), S(0, 1)]);
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [1, 4, 7] });
    expect(morris.legalMoves(s)).toEqual([]);
  });

  it("TM4: the third occurrence of a position is a draw, and so is the 60th ply", () => {
    // Both sides slide a piece out and back; the position after the placements recurs.
    const setup = [0, 8, 3, 6, 7, 5];
    const loop = [S(0, 1), S(5, 2), S(1, 0), S(2, 5)];
    expect(play([...setup, ...loop]).result).toBeNull(); // the second occurrence
    expect(play([...setup, ...loop, ...loop]).result).toEqual({
      kind: "draw",
      reason: "repetition",
    });
    const long = createMorris({ ...MORRIS_RULES, repetitionLimit: 99 });
    const moves = [...setup, ...Array.from({ length: 14 }, () => loop).flat()];
    const s = play(moves.slice(0, 60), long);
    expect(s.moves).toHaveLength(60);
    expect(s.result).toEqual({ kind: "draw", reason: "ply-cap" });
  });

  it("every unfinished position has a move, so no side is ever boxed in", () => {
    const queue = [pureMorris.init("X"), pureMorris.init("O")];
    const seen = new Set<string>();
    for (const s of queue) {
      if (seen.has(pureMorris.key(s))) continue;
      seen.add(pureMorris.key(s));
      if (s.result) continue;
      const moves = pureMorris.legalMoves(s);
      expect(moves.length).toBeGreaterThan(0);
      for (const m of moves) queue.push(pureMorris.apply(s, m));
    }
    expect(seen.size).toBe(7722);
  });

  it("fairness: perfect play draws; a first piece in the centre would win, hence TM1", () => {
    const sol = solve(pureMorris, [pureMorris.init("X"), pureMorris.init("O")]);
    expect(sol.value(pureMorris.init("X")).outcome).toBe("draw");
    const free = createMorris({
      noCentreOpening: false,
      repetitionLimit: Number.POSITIVE_INFINITY,
      maxPlies: Number.POSITIVE_INFINITY,
    });
    const s0 = free.init("X");
    expect(solve(free, [s0]).value(free.apply(s0, 4))).toEqual({ outcome: "X", plies: 8 });
  });
});
