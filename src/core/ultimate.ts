// Ultimate: nine 3×3 boards in a 3×3 big board. The cell you play sends the opponent to
// the board in the same place; three in a row claims a board, and three claimed boards in
// a row win (docs/gdd.md §3.6, rules U1–U6). Cells are board-major: cell = board × 9 +
// the cell's place in its board, both row-major. The computer is MCTS (src/core/mcts.ts).
import { randomPlayer } from "./players";
import type { Rng } from "./rng";
import {
  LINES_3x3,
  lineThrough,
  type Mark,
  type Mode,
  other,
  type Result,
  type Side,
} from "./types";

/** A small board: claimed by a side, dead (full without a line), or still open (U4). */
export type BoardState = Side | "dead" | null;

export interface UltimateState {
  /** 81 cells, board after board. */
  readonly cells: readonly Mark[];
  readonly toMove: Side;
  readonly moves: readonly number[];
  readonly boards: readonly BoardState[];
  /** Per board: the line that claimed it (cells), or null. */
  readonly claims: ReadonlyArray<readonly number[] | null>;
  /** The board the side to move is sent to, or null when any open board will do (U2, U3). */
  readonly target: number | null;
  readonly result: Result | null;
}

const ULTIMATE_CELLS = 81;
/** U6: the number of random moves in a fair start. */
const FAIR_START_MOVES = 4;

export const boardOf = (cell: number) => Math.floor(cell / 9);

/**
 * Whether `side` can still claim board `b`: it has, or the board is open and one of its
 * lines holds no mark of the other side.
 */
function claimable(s: Pick<UltimateState, "cells" | "boards">, b: number, side: Side): boolean {
  const state = s.boards[b];
  if (state !== null) return state === side;
  const them = other(side);
  return LINES_3x3.some((l) => l.every((i) => s.cells[b * 9 + i] !== them));
}

/** U5: whether a line of three boards can still be claimed by `side`. */
const lineOpen = (s: Pick<UltimateState, "cells" | "boards">, side: Side) =>
  LINES_3x3.some((l) => l.every((b) => claimable(s, b, side)));

export const ultimate = {
  id: "ultimate",
  cells: ULTIMATE_CELLS,
  init: (first: Side = "X"): UltimateState => ({
    cells: Array(ULTIMATE_CELLS).fill(null),
    toMove: first,
    moves: [],
    boards: Array(9).fill(null),
    claims: Array(9).fill(null),
    target: null,
    result: null,
  }),
  // U2, U3: an empty cell of the target board, or of any open board when there is none.
  legalMoves: (s) =>
    s.result
      ? []
      : s.cells.flatMap((m, i) =>
          m === null &&
          s.boards[boardOf(i)] === null &&
          (s.target === null || boardOf(i) === s.target)
            ? [i]
            : [],
        ),
  apply(s, cell) {
    if (s.result || !Number.isInteger(cell) || s.cells[cell] !== null) return s; // R2
    const b = boardOf(cell);
    if (s.boards[b] !== null || (s.target !== null && b !== s.target)) return s;
    const side = s.toMove;
    const cells = s.cells.slice();
    cells[cell] = side;
    const moves = [...s.moves, cell];
    // U4: three in a row claims the board; a full board without a line is dead.
    const board = cells.slice(b * 9, b * 9 + 9);
    const line = lineThrough(board, cell - b * 9, side);
    const full = board.every((m) => m !== null);
    const boards =
      line || full ? s.boards.map((st, j) => (j === b ? (line ? side : "dead") : st)) : s.boards;
    const claims = line
      ? s.claims.map((c, j) => (j === b ? line.map((i) => b * 9 + i) : c))
      : s.claims;
    // U5: three claimed boards in a row win. The line is their centre cells, so the views
    // draw it across the boards.
    const won = line && LINES_3x3.find((l) => l.includes(b) && l.every((j) => boards[j] === side));
    // U5: drawn when neither side can still claim a line of three boards. This also covers
    // a big board with no open board left (R4).
    const next = { cells, boards };
    const result: Result | null = won
      ? { kind: "win", winner: side, line: won.map((j) => j * 9 + 4) }
      : !lineOpen(next, "X") && !lineOpen(next, "O")
        ? { kind: "draw", reason: "no-line" }
        : null;
    // U2: the cell's place sends the opponent to that board; U3: unless it is closed.
    const sent = cell - b * 9;
    return {
      cells,
      toMove: result ? side : other(side),
      moves,
      boards,
      claims,
      target: result || boards[sent] !== null ? null : sent,
      result,
    };
  },
  result: (s) => s.result,
  toMove: (s) => s.toMove,
  key: (s) => `${s.cells.map((m) => m ?? ".").join("")}${s.toMove}${s.target ?? "*"}`,
} satisfies Mode<UltimateState>;

/** U6, "Fair start": the first four moves are random legal moves from the game's generator. */
export function fairStart(s: UltimateState, rng: Rng): UltimateState {
  const random = randomPlayer(ultimate, rng);
  let next = s;
  for (let i = 0; i < FAIR_START_MOVES; i++) next = ultimate.apply(next, random(next));
  return next;
}
