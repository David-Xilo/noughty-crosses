// Saucer: Classic, but after every third move a flying saucer grabs the piece just
// placed. On the board's edge it pushes the piece one cell clockwise, if that cell is
// empty; from the centre it carries the piece away (docs/gdd.md §3.8, rules S1–S5). The
// player making a third move knows the saucer is coming, and aims the push.
import { classicRank } from "./classic";
import { lineThrough, type Mark, type Mode, other, type Result, type Side } from "./types";

/** S3: the saucer comes after every third move of the game. */
const VISIT_EVERY = 3;
const CENTRE = 4;
/** S3: the board's edge cells in clockwise order, from the top left corner. */
const RING: readonly number[] = [0, 1, 2, 5, 8, 7, 6, 3];

/** The cell clockwise of `cell` on the board's edge; the centre has none. */
export const clockwise = (cell: number): number | null => {
  const i = RING.indexOf(cell);
  return i < 0 ? null : (RING[(i + 1) % RING.length] as number);
};

/**
 * What a visit did to the piece placed on `from`: pushed it to `to`, left it (`to` is
 * `from`: the next cell was taken), or carried it away (`to` is null).
 */
export interface Visit {
  readonly side: Side;
  readonly from: number;
  readonly to: number | null;
}

export interface SaucerState {
  readonly cells: readonly Mark[];
  readonly toMove: Side;
  readonly moves: readonly number[];
  /** The visit after the last move, if there was one (for the table and the status line). */
  readonly visit: Visit | null;
  readonly result: Result | null;
}

/** Whether the saucer comes for the piece the side to move places now (S3). */
export const visitNow = (s: Pick<SaucerState, "moves" | "result">) =>
  !s.result && (s.moves.length + 1) % VISIT_EVERY === 0;

const legalMoves = (s: SaucerState): number[] =>
  s.result
    ? []
    : s.cells.flatMap((m, i) => (m === null && !(i === CENTRE && !s.moves.length) ? [i] : []));

export const saucer: Mode<SaucerState> = {
  id: "saucer",
  cells: 9,
  init: (first = "X") => ({
    cells: Array<Mark>(9).fill(null),
    toMove: first,
    moves: [],
    visit: null,
    result: null,
  }),
  legalMoves,
  apply(s, cell) {
    if (!legalMoves(s).includes(cell)) return s; // R2, S2
    const side = s.toMove;
    const cells = s.cells.slice();
    cells[cell] = side;
    const moves = [...s.moves, cell];
    const after = (visit: Visit | null, result: Result | null): SaucerState => ({
      cells,
      toMove: result ? side : other(side),
      moves,
      visit,
      result,
    });
    // S1: three in a row wins at once, before any visit.
    const line = lineThrough(cells, cell, side);
    if (line) return after(null, { kind: "win", winner: side, line });
    let visit: Visit | null = null;
    if (moves.length % VISIT_EVERY === 0) {
      // S3: pushed clockwise onto an empty cell, left where it is, or carried away.
      const next = clockwise(cell);
      const to = next === null ? null : cells[next] === null ? next : cell;
      cells[cell] = null;
      if (to !== null) cells[to] = side;
      visit = { side, from: cell, to };
      // S4: a push that completes three in a row wins.
      const pushed = to === null || to === cell ? null : lineThrough(cells, to, side);
      if (pushed) return after(visit, { kind: "win", winner: side, line: pushed });
    }
    // S1: a full board with no line is a draw.
    if (!cells.includes(null)) return after(visit, { kind: "draw", reason: "board-full" });
    return after(visit, null);
  },
  result: (s) => s.result,
  toMove: (s) => s.toMove,
  // S5: the board, the side to move and the saucer's rhythm fix the position.
  key: (s) => `${s.cells.map((m) => m ?? ".").join("")}${s.toMove}${s.moves.length % VISIT_EVERY}`,
};

/** The ranks of the shipped table: a Classic rank per step of the saucer's rhythm. */
export const SAUCER_RANKS = 3 ** 9 * 2 * VISIT_EVERY;

export const saucerRank = (s: SaucerState) =>
  (s.moves.length % VISIT_EVERY) * 3 ** 9 * 2 + classicRank(s);
