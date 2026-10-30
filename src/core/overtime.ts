// Overtime: Classic on 3×3; a draw grows the board to 5×5 and play goes on with four in a
// row (docs/gdd.md §3.8, rules O1–O5). The cells are 3×3 until the growth and 5×5 after
// it, so a move's cell is read on the board of its time; the record replays exactly (R7).
import { BIG_GAME, BIG_LINES, BIG_SIZE, bigBoard } from "./bigboard";
import { type ClassicState, classic } from "./classic";
import { type Level, levelPlayer, type Player } from "./players";
import type { Rng } from "./rng";
import { SEARCH_LEVELS, type SearchLevel, searchMove } from "./search";
import { type Solution, solve } from "./solver";
import { type Mode, other } from "./types";

/** Where each 3×3 cell sits on the 5×5 board: the centre, inside the ring (O2). */
export const OVERTIME_CENTRE = Array.from(
  { length: 9 },
  (_, i) => (Math.floor(i / 3) + 1) * BIG_SIZE + (i % 3) + 1,
);

/** Whether the board has grown to 5×5. */
export const grown = (s: ClassicState) => s.cells.length === BIG_SIZE * BIG_SIZE;

/** O2: the 3×3 marks moved to the centre of an empty 5×5 board. */
function grow(cells: ClassicState["cells"]): ClassicState["cells"] {
  const big = Array(BIG_SIZE * BIG_SIZE).fill(null);
  cells.forEach((m, i) => {
    big[OVERTIME_CENTRE[i] as number] = m;
  });
  return big;
}

/**
 * O5: whether no line of four is open for either side, so neither can win any more. A line
 * is open for a side while it holds no mark of the other side.
 */
export const deadBoard = (cells: ClassicState["cells"]) =>
  BIG_LINES.every(
    (line) => line.some((c) => cells[c] === "X") && line.some((c) => cells[c] === "O"),
  );

export const overtime: Mode<ClassicState> = {
  id: "overtime",
  cells: BIG_SIZE * BIG_SIZE, // after the growth; 9 before it
  init: classic.init,
  legalMoves: classic.legalMoves,
  apply(s, cell) {
    // O4: the grown board plays as the Big board (B2). O5: the draw comes as soon as no line
    // of four is open for either side, not when the board is full (David, 2026-10-30, P27).
    if (grown(s)) {
      const next = bigBoard.apply(s, cell);
      if (next === s || next.result || !deadBoard(next.cells)) return next;
      return { ...next, result: { kind: "draw", reason: "dead-board" } };
    }
    // O1: Classic. O2, O3: its draw grows the board, and the other side moves.
    const next = classic.apply(s, cell);
    if (next.result?.kind !== "draw") return next;
    return { cells: grow(next.cells), toMove: other(s.toMove), moves: next.moves, result: null };
  },
  result: (s) => s.result,
  toMove: (s) => s.toMove,
  key: classic.key,
};

/**
 * Where the mark of `cell`, just played, sits now: the move that grew the board is the
 * ninth, and it moved into the centre with the others (O2).
 */
export const placedAt = (s: ClassicState, cell: number) =>
  grown(s) && s.moves.length === 9 ? (OVERTIME_CENTRE[cell] ?? cell) : cell;

/**
 * The 3×3 phase is valued as Classic: the offline solve found that every Classic draw stays
 * a draw on the grown board (research TTT-4.1.11), so the two games' values are equal. It is
 * solved once, on first use, inside the search worker (about 10,000 positions).
 */
let opening: Solution<ClassicState> | null = null;
const openingSolution = () => {
  opening ??= solve(classic, [classic.init("X"), classic.init("O")]);
  return opening;
};

/**
 * The Big board's levels on the grown board, but Casual's noise is 200, not 100: around a
 * drawn centre few lines of four stay open, and with 100 Keen won only 4% of the games
 * that grew, 69.4% in all (research TTT-4.1.11).
 */
const RING_LEVELS: Record<Level, SearchLevel> = {
  ...SEARCH_LEVELS,
  casual: { ...SEARCH_LEVELS.casual, noise: 200 },
};

/**
 * The computer at `level` (GDD §4.1): Classic's level on 3×3, then the Big board's search on
 * the grown board, both seeded by `rng`.
 */
export const overtimePlayer =
  (level: Level, rng: Rng): Player<ClassicState> =>
  (s) =>
    grown(s)
      ? searchMove(BIG_GAME, s.cells, s.toMove, RING_LEVELS[level], rng)
      : levelPlayer(level, classic, openingSolution(), rng)(s);
