// Gravity: a 6×6 board standing upright; a move picks a column and the mark drops to its
// lowest empty cell; four in a row wins; a full board is a draw (docs/gdd.md §3.5, rules
// G1–G3). Cells are row-major with row 0 at the top. The computer searches as on the Big
// board (src/core/search.ts), on the landing cells only.
import type { ClassicState } from "./classic";
import type { Level, Player } from "./players";
import type { Rng } from "./rng";
import { type LineGame, SEARCH_LEVELS, searchMove } from "./search";
import { linesOf, lineThrough, type Mark, type Mode, other } from "./types";

export const GRAVITY_SIZE = 6;
const GRAVITY_K = 4;
/** The 54 lines of four: 18 rows, 18 columns and 18 diagonals. */
export const GRAVITY_LINES = linesOf(GRAVITY_SIZE, GRAVITY_SIZE, GRAVITY_K);
const N = GRAVITY_SIZE * GRAVITY_SIZE;

/** The lowest empty cell in `cell`'s column, or null when the column is full (G1). */
export function landing(cells: readonly Mark[], cell: number): number | null {
  for (let c = N - GRAVITY_SIZE + (cell % GRAVITY_SIZE); c >= 0; c -= GRAVITY_SIZE)
    if (cells[c] === null) return c;
  return null;
}

export const gravity: Mode<ClassicState> = {
  id: "gravity",
  cells: N,
  init: (first = "X") => ({ cells: Array(N).fill(null), toMove: first, moves: [], result: null }),
  // G1: one move per column that is not full, named by the cell where the mark lands.
  legalMoves: (s) =>
    s.result
      ? []
      : Array.from({ length: GRAVITY_SIZE }, (_, x) => landing(s.cells, x)).filter(
          (c): c is number => c !== null,
        ),
  apply(s, cell) {
    if (s.result || !Number.isInteger(cell) || cell < 0 || cell >= N) return s;
    if (landing(s.cells, cell) !== cell) return s; // a mark rests on the bottom or a mark (G1)
    const cells = s.cells.slice();
    cells[cell] = s.toMove;
    const moves = [...s.moves, cell];
    // G2: four in a row wins; G3: a full board is a draw.
    const line = lineThrough(cells, cell, s.toMove, GRAVITY_LINES);
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

const GRAVITY_GAME: LineGame = {
  cells: N,
  k: GRAVITY_K,
  lines: GRAVITY_LINES,
  width: GRAVITY_SIZE,
};

/** The computer at `level` (GDD §4.1, line games): alpha-beta, seeded by `rng`. */
export const gravityPlayer =
  (level: Level, rng: Rng): Player<ClassicState> =>
  (s) =>
    searchMove(GRAVITY_GAME, s.cells, s.toMove, SEARCH_LEVELS[level], rng);
