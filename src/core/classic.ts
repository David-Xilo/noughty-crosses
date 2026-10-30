// Classic: 3×3, three in a row wins, a full board is a draw (docs/gdd.md §3.1).
import { lineThrough, type Mark, type Mode, other, type Result, type Side } from "./types";

export interface ClassicState {
  readonly cells: readonly Mark[];
  readonly toMove: Side;
  readonly moves: readonly number[];
  readonly result: Result | null;
}

export const classic: Mode<ClassicState> = {
  id: "classic",
  cells: 9,
  init: (first = "X") => ({ cells: Array(9).fill(null), toMove: first, moves: [], result: null }),
  legalMoves: (s) => (s.result ? [] : s.cells.flatMap((m, i) => (m === null ? [i] : []))),
  apply(s, cell) {
    if (s.result || !Number.isInteger(cell) || s.cells[cell] !== null) return s;
    const cells = s.cells.slice();
    cells[cell] = s.toMove;
    const moves = [...s.moves, cell];
    const line = lineThrough(cells, cell, s.toMove);
    if (line)
      return { cells, toMove: s.toMove, moves, result: { kind: "win", winner: s.toMove, line } };
    if (!cells.includes(null))
      return { cells, toMove: s.toMove, moves, result: { kind: "draw", reason: "board-full" } };
    return { cells, toMove: other(s.toMove), moves, result: null };
  },
  result: (s) => s.result,
  toMove: (s) => s.toMove,
  key: (s) => `${s.cells.map((m) => m ?? ".").join("")}${s.toMove}`,
};

/** Position rank for the shipped solution table: the cells in base 3, times the side to move. */
export const CLASSIC_RANKS = 3 ** 9 * 2;

export function classicRank(s: Pick<ClassicState, "cells" | "toMove">): number {
  let r = 0;
  for (const m of s.cells) r = r * 3 + (m === null ? 0 : m === "X" ? 1 : 2);
  return r * 2 + (s.toMove === "O" ? 1 : 0);
}
