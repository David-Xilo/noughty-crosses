// Notakto: both sides place X on one to three 3×3 boards; a board with three in a row is
// dead, and whoever kills the last live board loses (docs/gdd.md §3.7, rules N1–N5).
// The game is impartial, so a position is its live boards up to symmetry and order, plus
// the side to move: that key and rank let one solved table serve every board count.
import { LINES_3x3, type Mark, type Mode, other, type Result, type Side } from "./types";

export interface NotaktoState {
  /** Nine cells per board, row-major, board after board; every mark is an X (N1). */
  readonly cells: readonly Mark[];
  /** The player to move. Both players place X; X and O name the players, not the marks. */
  readonly toMove: Side;
  readonly moves: readonly number[];
  /** Per board: the line that killed it (cell indices), or null while it is live (N2). */
  readonly dead: ReadonlyArray<readonly number[] | null>;
  readonly result: Result | null;
}

const MAX_BOARDS = 3;

/** The eight symmetries of a 3×3 board, as cell maps. */
const SYMMETRIES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [6, 3, 0, 7, 4, 1, 8, 5, 2],
  [8, 7, 6, 5, 4, 3, 2, 1, 0],
  [2, 5, 8, 1, 4, 7, 0, 3, 6],
  [2, 1, 0, 5, 4, 3, 8, 7, 6],
  [6, 7, 8, 3, 4, 5, 0, 1, 2],
  [0, 3, 6, 1, 4, 7, 2, 5, 8],
  [8, 5, 2, 7, 4, 1, 6, 3, 0],
] as const;

const hasLine = (mask: number) => LINES_3x3.some((l) => l.every((i) => (mask >> i) & 1));
const canonical = (mask: number) =>
  Math.min(
    ...SYMMETRIES.map((p) =>
      p.reduce<number>((a, src, dst) => a | (((mask >> src) & 1) << dst), 0),
    ),
  );

/** For each 9-bit board mask: the id of its live shape up to symmetry, or -1 if dead. */
const LIVE_ID = (() => {
  const shapes = [
    ...new Set(
      Array.from({ length: 512 }, (_, m) => m)
        .filter((m) => !hasLine(m))
        .map(canonical),
    ),
  ];
  shapes.sort((a, b) => a - b);
  return Int8Array.from({ length: 512 }, (_, m: number) =>
    hasLine(m) ? -1 : shapes.indexOf(canonical(m)),
  );
})();
/** Live board shapes up to symmetry (46); the id after the last stands for "no board". */
const LIVE_SHAPES = Math.max(...LIVE_ID) + 1;

const boardMask = (cells: readonly Mark[], b: number) => {
  let m = 0;
  for (let i = 0; i < 9; i++) if (cells[b * 9 + i]) m |= 1 << i;
  return m;
};

/** The live boards' shape ids, largest first, padded to three with the "no board" id. */
function shapeIds(s: Pick<NotaktoState, "cells" | "dead">): number[] {
  const ids = s.dead.flatMap((d, b) => (d ? [] : [LIVE_ID[boardMask(s.cells, b)] as number]));
  while (ids.length < MAX_BOARDS) ids.push(LIVE_SHAPES);
  return ids.sort((a, b) => b - a);
}

const lineOn = (cells: readonly Mark[], b: number, cell: number): number[] | null => {
  const local = cell - b * 9;
  const line = LINES_3x3.find((l) => l.includes(local) && l.every((i) => cells[b * 9 + i]));
  return line ? line.map((i) => b * 9 + i) : null;
};

export const notakto = {
  id: "notakto",
  cells: 9 * MAX_BOARDS,
  /** N1: one to three boards, all empty. */
  init(first: Side = "X", boards = 1): NotaktoState {
    if (!Number.isInteger(boards) || boards < 1 || boards > MAX_BOARDS)
      throw new Error(`notakto: ${boards} boards`);
    return {
      cells: Array(9 * boards).fill(null),
      toMove: first,
      moves: [],
      dead: Array(boards).fill(null),
      result: null,
    };
  },
  legalMoves: (s) =>
    s.result
      ? []
      : s.cells.flatMap((m, i) => (m === null && !s.dead[Math.floor(i / 9)] ? [i] : [])),
  apply(s, cell) {
    const b = Math.floor(cell / 9);
    if (s.result || !Number.isInteger(cell) || s.cells[cell] !== null || s.dead[b] !== null)
      return s; // R2; N2: a dead board takes no more marks
    const cells = s.cells.slice();
    cells[cell] = "X";
    const moves = [...s.moves, cell];
    const line = lineOn(cells, b, cell);
    if (!line) return { cells, toMove: other(s.toMove), moves, dead: s.dead, result: null };
    const dead = s.dead.slice();
    dead[b] = line;
    // N3: killing the last live board loses; N4: there are no draws.
    if (dead.every((d) => d !== null))
      return {
        cells,
        toMove: s.toMove,
        moves,
        dead,
        result: { kind: "win", winner: other(s.toMove), line },
      };
    return { cells, toMove: other(s.toMove), moves, dead, result: null };
  },
  result: (s) => s.result,
  toMove: (s) => s.toMove,
  key: (s) => `${shapeIds(s).join(",")}${s.toMove}`,
} satisfies Mode<NotaktoState>;

/** Position rank for the shipped table: the multiset of live shapes, times the side to move. */
export const NOTAKTO_RANKS = 2 * binomial(LIVE_SHAPES + MAX_BOARDS, MAX_BOARDS);

export function notaktoRank(s: Pick<NotaktoState, "cells" | "dead" | "toMove">): number {
  const [a, b, c] = shapeIds(s) as [number, number, number];
  const r = binomial(a + 2, 3) + binomial(b + 1, 2) + c;
  return r * 2 + (s.toMove === "O" ? 1 : 0);
}

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
