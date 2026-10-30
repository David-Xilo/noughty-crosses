import { describe, expect, it } from "vitest";
import {
  clockwise,
  SAUCER_RANKS,
  type SaucerState,
  saucer,
  saucerRank,
  visitNow,
} from "../../src/core/saucer";
import { solve } from "../../src/core/solver";
import type { Mode } from "../../src/core/types";

const play = (moves: number[], first: "X" | "O" = "X") =>
  moves.reduce(saucer.apply, saucer.init(first));

describe("Saucer (GDD §3.8)", () => {
  it("S1: three in a row by a placement wins at once, before the saucer comes", () => {
    // X's 1 stays on move 3 (O holds 2); X's line on move 5 needs no visit.
    expect(play([2, 5, 1, 3, 0]).result).toEqual({ kind: "win", winner: "X", line: [0, 1, 2] });
    const s = play([0, 3, 8, 4, 1, 5]);
    expect(s.result).toEqual({ kind: "win", winner: "O", line: [3, 4, 5] });
    expect(s.visit).toBeNull();
  });

  it("S2: the first piece may not go in the centre", () => {
    const s0 = saucer.init("O");
    expect(saucer.legalMoves(s0)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(saucer.apply(s0, 4)).toBe(s0); // R2
    expect(play([0, 4]).cells[4]).toBe("O");
  });

  it("S3: every third move the saucer pushes the piece clockwise, leaves it, or carries it off", () => {
    expect([0, 1, 2, 5, 8, 7, 6, 3, 4].map(clockwise)).toEqual([1, 2, 5, 8, 7, 6, 3, 0, null]);
    expect(visitNow(play([]))).toBe(false);
    expect(visitNow(play([0, 1]))).toBe(true);
    // Pushed: X's 6 goes on to 3.
    const pushed = play([0, 1, 6]);
    expect(pushed.visit).toEqual({ side: "X", from: 6, to: 3 });
    expect(pushed.cells).toEqual(["X", "O", null, "X", null, null, null, null, null]);
    expect(pushed.toMove).toBe("O");
    // Left: X's 0 cannot go on to O's 1.
    expect(play([2, 1, 0]).visit).toEqual({ side: "X", from: 0, to: 0 });
    expect(play([2, 1, 0]).cells[0]).toBe("X");
    // Carried off: the centre is empty again, and the next visit is three moves later.
    const carried = play([0, 1, 4]);
    expect(carried.visit).toEqual({ side: "X", from: 4, to: null });
    expect(carried.cells[4]).toBeNull();
    expect(play([0, 1, 4, 5]).visit).toBeNull();
    expect(play([0, 1, 4, 5, 8, 6]).visit).toEqual({ side: "O", from: 6, to: 3 });
  });

  it("S4: a push that completes a line wins; a full board after a visit draws", () => {
    // The rule card's demo: X's 7 is pushed to 6, beside 0 and 3.
    const s = play([1, 2, 6, 5, 8, 4, 0, 4, 7]);
    expect(s.visit).toEqual({ side: "X", from: 7, to: 6 });
    expect(s.result).toEqual({ kind: "win", winner: "X", line: [0, 3, 6] });
    expect(saucer.legalMoves(s)).toEqual([]);
    // Perfect play: X's last piece, on 6, cannot go on to 3 (O), and the board is full.
    const full = play([0, 4, 1, 1, 7, 3, 5, 8, 6]);
    expect(full.visit).toEqual({ side: "X", from: 6, to: 6 });
    expect(full.result).toEqual({ kind: "draw", reason: "board-full" });
  });

  it("S5: the board, the side to move and the rhythm fix a position; ranks are unique", () => {
    const seen = new Map<number, string>();
    const queue = [saucer.init("X"), saucer.init("O")];
    for (const s of queue) {
      const r = saucerRank(s);
      expect(r).toBeLessThan(SAUCER_RANKS);
      const key = saucer.key(s);
      if (seen.has(r)) {
        expect(seen.get(r)).toBe(key);
        continue;
      }
      seen.set(r, key);
      for (const m of saucer.legalMoves(s)) queue.push(saucer.apply(s, m));
    }
    expect(seen.size).toBe(35_122);
  });

  it("fairness: a draw from either start and from every first move", () => {
    const sol = solve(saucer, [saucer.init("X"), saucer.init("O")]);
    expect(sol.positions).toBe(35_122);
    expect(sol.longestForcedWin).toBe(7);
    for (const first of ["X", "O"] as const) {
      const s0 = saucer.init(first);
      expect(sol.value(s0).outcome).toBe("draw");
      for (const m of saucer.legalMoves(s0))
        expect(sol.value(saucer.apply(s0, m)).outcome).toBe("draw");
    }
    // Without S2, the first player wins.
    const free: Mode<SaucerState> = {
      ...saucer,
      legalMoves: (s) => (s.result ? [] : s.cells.flatMap((c, i) => (c ? [] : [i]))),
      apply: (s, cell) =>
        s.moves.length === 0 && cell === 4 && !s.cells[4]
          ? {
              ...s,
              cells: s.cells.map((c, i) => (i === 4 ? s.toMove : c)),
              moves: [4],
              toMove: "O",
            }
          : saucer.apply(s, cell),
    };
    expect(solve(free, free.init("X")).value(free.init("X")).outcome).toBe("X");
  });
});
