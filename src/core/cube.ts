// Cube: a 4×4×4 cube, four in a line wins in any of the 13 directions; after the 7th mark
// it grows once to 5×5×5, one layer on the top, right and back faces (docs/gdd.md §3.8,
// rules C1–C6). Cells are layer by layer from the bottom, then row by row from the back,
// then column by column from the left: (layer * n + row) * n + column. A move's cell is read
// on the cube of its time, so the record replays exactly (R7, C6).
import type { ClassicState } from "./classic";
import type { Level, Player } from "./players";
import type { Rng } from "./rng";
import { type LineGame, SEARCH_LEVELS, searchMove } from "./search";
import { lineThrough, type Mode, other } from "./types";

export const CUBE_SIZE = 4;
export const CUBE_CAP = 5;
const CUBE_K = 4;
/** C3: the cube grows after this many marks. */
const CUBE_GROWS_AFTER = 7;

/** Every line of k cells in an n×n×n cube, in the 13 directions of space (C2). */
function cubeLines(n: number, k: number): number[][] {
  const dirs: Array<[number, number, number]> = [];
  for (const dl of [-1, 0, 1])
    for (const dr of [-1, 0, 1])
      for (const dc of [-1, 0, 1]) {
        // One of each pair of opposite directions: the first step that is not 0 is +1.
        const first = dl || dr || dc;
        if (first === 1) dirs.push([dl, dr, dc]);
      }
  const inside = (v: number) => v >= 0 && v < n;
  const lines: number[][] = [];
  for (let l = 0; l < n; l++)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        for (const [dl, dr, dc] of dirs) {
          const end = (v: number, d: number) => v + d * (k - 1);
          if (!inside(end(l, dl)) || !inside(end(r, dr)) || !inside(end(c, dc))) continue;
          lines.push(
            Array.from({ length: k }, (_, j) => ((l + dl * j) * n + r + dr * j) * n + c + dc * j),
          );
        }
  return lines;
}

/** The 76 lines of four of the 4×4×4 cube, and the 302 of the 5×5×5 cube. */
export const CUBE_LINES = cubeLines(CUBE_SIZE, CUBE_K);
export const CAP_LINES = cubeLines(CUBE_CAP, CUBE_K);

/** Where each cell of the 4×4×4 cube sits on the grown one: one row further from the back (C3). */
export const CUBE_GROWN = Array.from({ length: CUBE_SIZE ** 3 }, (_, i) => {
  const l = Math.floor(i / CUBE_SIZE ** 2);
  const r = Math.floor(i / CUBE_SIZE) % CUBE_SIZE;
  const c = i % CUBE_SIZE;
  return (l * CUBE_CAP + r + 1) * CUBE_CAP + c;
});

/** Whether the cube has grown to 5×5×5. */
export const cubeGrown = (s: ClassicState) => s.cells.length === CUBE_CAP ** 3;

export const cube: Mode<ClassicState> = {
  id: "cube",
  cells: CUBE_CAP ** 3, // after the growth; 64 before it
  init: (first = "X") => ({
    cells: Array(CUBE_SIZE ** 3).fill(null),
    toMove: first,
    moves: [],
    result: null,
  }),
  legalMoves: (s) => (s.result ? [] : s.cells.flatMap((m, i) => (m === null ? [i] : []))),
  apply(s, cell) {
    if (s.result || !Number.isInteger(cell) || s.cells[cell] !== null) return s;
    let cells = s.cells.slice();
    cells[cell] = s.toMove;
    const moves = [...s.moves, cell];
    // C2, C5: four in a line wins, on the cube of the move's time.
    const line = lineThrough(cells, cell, s.toMove, cubeGrown(s) ? CAP_LINES : CUBE_LINES);
    if (line)
      return { cells, toMove: s.toMove, moves, result: { kind: "win", winner: s.toMove, line } };
    // C3: after the 7th mark the cube grows, every mark in its place; C4: turns alternate.
    if (!cubeGrown(s) && moves.length === CUBE_GROWS_AFTER) {
      const big = Array(CUBE_CAP ** 3).fill(null);
      cells.forEach((m, i) => {
        big[CUBE_GROWN[i] as number] = m;
      });
      cells = big;
    }
    if (!cells.includes(null))
      return { cells, toMove: s.toMove, moves, result: { kind: "draw", reason: "board-full" } };
    return { cells, toMove: other(s.toMove), moves, result: null };
  },
  result: (s) => s.result,
  toMove: (s) => s.toMove,
  key: (s) => `${s.cells.map((m) => m ?? ".").join("")}${s.toMove}`,
};

/** Where the mark of `cell`, just played, sits now: the 7th mark moved with the growth (C3). */
export const cubePlacedAt = (s: ClassicState, cell: number) =>
  cubeGrown(s) && s.moves.length === CUBE_GROWS_AFTER ? (CUBE_GROWN[cell] ?? cell) : cell;

const SMALL: LineGame = { cells: CUBE_SIZE ** 3, k: CUBE_K, lines: CUBE_LINES };
const GROWN: LineGame = { cells: CUBE_CAP ** 3, k: CUBE_K, lines: CAP_LINES };
/**
 * Nodes per move: a node scans the cube's lines, ten times the Big board's, so half the Big
 * board's budget keeps Sharp under 100 ms on the grown cube (research TTT-4.1.12).
 */
const CUBE_BUDGET = 20_000;

/** The computer at `level` (GDD §4.1): the Big board's levels, seeded by `rng`. */
export const cubePlayer =
  (level: Level, rng: Rng): Player<ClassicState> =>
  (s) =>
    searchMove(
      cubeGrown(s) ? GROWN : SMALL,
      s.cells,
      s.toMove,
      SEARCH_LEVELS[level],
      rng,
      CUBE_BUDGET,
    );
