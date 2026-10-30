// Big board: a 5×5 board, four in a row wins, a full board is a draw (docs/gdd.md §3.4,
// rules B1–B3). Classic's moves and state on a larger board; no table, the computer
// searches (src/core/search.ts).
import type { ClassicState } from "./classic";
import type { Level, Player } from "./players";
import type { Rng } from "./rng";
import { type LineGame, SEARCH_LEVELS, searchMove } from "./search";
import { linesOf, lineThrough, type Mode, other } from "./types";

export const BIG_SIZE = 5;
const BIG_K = 4;
/** The 28 lines of four: ten rows, ten columns and eight diagonals. */
export const BIG_LINES = linesOf(BIG_SIZE, BIG_SIZE, BIG_K);

export const bigBoard: Mode<ClassicState> = {
  id: "bigboard",
  cells: BIG_SIZE * BIG_SIZE,
  init: (first = "X") => ({
    cells: Array(BIG_SIZE * BIG_SIZE).fill(null),
    toMove: first,
    moves: [],
    result: null,
  }),
  legalMoves: (s) => (s.result ? [] : s.cells.flatMap((m, i) => (m === null ? [i] : []))),
  apply(s, cell) {
    if (s.result || !Number.isInteger(cell) || s.cells[cell] !== null) return s;
    const cells = s.cells.slice();
    cells[cell] = s.toMove;
    const moves = [...s.moves, cell];
    // B2: four in a row wins; B3: a full board is a draw.
    const line = lineThrough(cells, cell, s.toMove, BIG_LINES);
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

export const BIG_GAME: LineGame = { cells: BIG_SIZE * BIG_SIZE, k: BIG_K, lines: BIG_LINES };

/** The computer at `level` (GDD §4.1, line games): alpha-beta, seeded by `rng`. */
export const bigBoardPlayer =
  (level: Level, rng: Rng): Player<ClassicState> =>
  (s) =>
    searchMove(BIG_GAME, s.cells, s.toMove, SEARCH_LEVELS[level], rng);
