// Three men's morris: each side places three pieces, then slides one a step along the
// board's lines on each turn; three of your own in a row wins (docs/gdd.md §3.8, rules
// TM1–TM5). It shares Classic's position rank: the board alone fixes the phase, because
// the pieces on it are counted. Repeats and the ply cap end games by history, so the
// solver works on `pureMorris`, as with Vanishing.
import {
  LINES_3x3,
  lineThrough,
  type Mark,
  type Mode,
  other,
  type Result,
  type Side,
} from "./types";

const PIECES_PER_SIDE = 3;
export const CENTRE = 4;

/** TM2: two cells are neighbours when they are next to each other on one of the 8 lines. */
export const NEIGHBOURS: ReadonlyArray<readonly number[]> = Array.from({ length: 9 }, (_, c) =>
  [
    ...new Set(
      LINES_3x3.flatMap((l) => {
        const i = l.indexOf(c);
        return i < 0 ? [] : [l[i - 1], l[i + 1]].filter((n): n is number => n !== undefined);
      }),
    ),
  ].sort((a, b) => a - b),
);

/** TM5: a placement is its cell (0–8); a slide is 9 + from · 9 + to (9–89). */
export const slideMove = (from: number, to: number) => 9 + from * 9 + to;
export const isSlide = (move: number) => move >= 9;
export const slideFrom = (move: number) => Math.floor((move - 9) / 9);
export const slideTo = (move: number) => (move - 9) % 9;
/** The cell a move puts a piece on. */
export const landing = (move: number) => (isSlide(move) ? slideTo(move) : move);

interface MorrisOptions {
  /** TM1: the first piece of the game may not go in the centre. */
  readonly noCentreOpening: boolean;
  /** TM4: the game is drawn on this occurrence of the same position. */
  readonly repetitionLimit: number;
  /** TM4: the game is drawn after this many plies without a winner. */
  readonly maxPlies: number;
}

export const MORRIS_RULES: MorrisOptions = {
  noCentreOpening: true,
  repetitionLimit: 3,
  maxPlies: 60,
};

export interface MorrisState {
  readonly cells: readonly Mark[];
  readonly toMove: Side;
  readonly moves: readonly number[];
  /** How often each position key has occurred, including the current one (TM4). */
  readonly seen: Readonly<Record<string, number>>;
  readonly result: Result | null;
}

const count = (cells: readonly Mark[], side: Side) => cells.filter((m) => m === side).length;

/** Whether `side` still places pieces (TM1); afterwards it slides them (TM2). */
const placing = (s: Pick<MorrisState, "cells" | "toMove">) =>
  count(s.cells, s.toMove) < PIECES_PER_SIDE;

const boardKey = (cells: readonly Mark[], toMove: Side) =>
  `${cells.map((m) => m ?? ".").join("")}${toMove}`;

export function createMorris(options: MorrisOptions = MORRIS_RULES): Mode<MorrisState> {
  const legalMoves = (s: MorrisState): number[] => {
    if (s.result) return [];
    if (placing(s))
      return s.cells.flatMap((m, i) =>
        // TM1: the first piece of the game may not go in the centre.
        m === null && !(options.noCentreOpening && i === CENTRE && !s.moves.length) ? [i] : [],
      );
    return s.cells.flatMap((m, from) =>
      m === s.toMove
        ? (NEIGHBOURS[from] as number[]).flatMap((to) =>
            s.cells[to] === null ? [slideMove(from, to)] : [],
          )
        : [],
    );
  };

  const end = (s: MorrisState, cells: Mark[], moves: number[], result: Result): MorrisState => ({
    cells,
    toMove: s.toMove,
    moves,
    seen: s.seen,
    result,
  });

  return {
    id: options === MORRIS_RULES ? "morris" : "morris-variant",
    cells: 9,
    init(first = "X") {
      const cells: Mark[] = Array(9).fill(null);
      return {
        cells,
        toMove: first,
        moves: [],
        seen: { [boardKey(cells, first)]: 1 },
        result: null,
      };
    },
    legalMoves,
    apply(s, move) {
      if (!legalMoves(s).includes(move)) return s; // R2
      const side = s.toMove;
      const cells = s.cells.slice();
      if (isSlide(move)) cells[slideFrom(move)] = null;
      const at = landing(move);
      cells[at] = side;
      const moves = [...s.moves, move];
      // TM3: three of your own in a row wins, while placing or sliding.
      const line = lineThrough(cells, at, side);
      if (line) return end(s, cells, moves, { kind: "win", winner: side, line });
      // A side always has a move: three pieces boxed in need the centre and two more cells
      // of the other side, and those make a line (test/core/morris.test.ts).
      const toMove = other(side);
      const key = boardKey(cells, toMove);
      const seen = { ...s.seen, [key]: (s.seen[key] ?? 0) + 1 };
      let result: Result | null = null;
      if ((seen[key] as number) >= options.repetitionLimit)
        result = { kind: "draw", reason: "repetition" };
      else if (moves.length >= options.maxPlies) result = { kind: "draw", reason: "ply-cap" };
      return { cells, toMove, moves, seen, result };
    },
    result: (s) => s.result,
    toMove: (s) => s.toMove,
    // The solving key ignores history; the empty board only occurs at the start.
    key: (s) => boardKey(s.cells, s.toMove),
  };
}

export const morris = createMorris();

/** Three men's morris without its history endings (TM4): the game graph the solver works on. */
export const pureMorris = createMorris({
  ...MORRIS_RULES,
  repetitionLimit: Number.POSITIVE_INFINITY,
  maxPlies: Number.POSITIVE_INFINITY,
});
