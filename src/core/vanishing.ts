// Vanishing: each side keeps at most three marks (docs/gdd.md §3.2, rules V1–V5).
// V2 (clarified at TTT-3.1): the new mark is placed, then the side's oldest mark is removed,
// and a line counts only on the board after that removal. While choosing, the oldest mark
// still occupies its cell, so that cell cannot be chosen.
import { lineThrough, type Mark, type Mode, other, type Result, type Side } from "./types";

export const EDGE_CELLS: readonly number[] = [1, 3, 5, 7];
export const MARKS_PER_SIDE = 3;

interface VanishingOptions {
  /** V3: the first move of the game may not be on an edge cell. */
  readonly noEdgeOpening: boolean;
  /** V4: the game is drawn on this occurrence of the same position. */
  readonly repetitionLimit: number;
  /** V5: the game is drawn after this many plies without a winner. */
  readonly maxPlies: number;
}

export const VANISHING_RULES: VanishingOptions = {
  noEdgeOpening: true,
  repetitionLimit: 3,
  maxPlies: 60,
};

export interface VanishingState {
  /** Each side's marks, oldest first (V1: at most three each). */
  readonly marks: { readonly X: readonly number[]; readonly O: readonly number[] };
  readonly toMove: Side;
  readonly moves: readonly number[];
  /** How often each position key has occurred, including the current one (V4). */
  readonly seen: Readonly<Record<string, number>>;
  readonly result: Result | null;
}

export function cellsOf(s: Pick<VanishingState, "marks">): Mark[] {
  const cells: Mark[] = Array(9).fill(null);
  for (const i of s.marks.X) cells[i] = "X";
  for (const i of s.marks.O) cells[i] = "O";
  return cells;
}

/** The mark that vanishes on `side`'s next placement (shown fading, V6), if any. */
export function nextToVanish(s: VanishingState, side: Side): number | null {
  const own = s.marks[side];
  return own.length >= MARKS_PER_SIDE ? (own[0] ?? null) : null;
}

const positionKey = (marks: VanishingState["marks"], toMove: Side) =>
  `${marks.X.join("")}|${marks.O.join("")}|${toMove}`;

export function createVanishing(options: VanishingOptions = VANISHING_RULES): Mode<VanishingState> {
  const legalMoves = (s: VanishingState): number[] => {
    if (s.result) return [];
    const cells = cellsOf(s);
    return cells.flatMap((m, i) => {
      if (m !== null) return [];
      if (options.noEdgeOpening && s.moves.length === 0 && EDGE_CELLS.includes(i)) return [];
      return [i];
    });
  };

  return {
    id: options === VANISHING_RULES ? "vanishing" : "vanishing-variant",
    cells: 9,
    init(first = "X") {
      const marks = { X: [], O: [] };
      return {
        marks,
        toMove: first,
        moves: [],
        seen: { [positionKey(marks, first)]: 1 },
        result: null,
      };
    },
    legalMoves,
    apply(s, cell) {
      if (!legalMoves(s).includes(cell)) return s;
      const side = s.toMove;
      const own = [...s.marks[side], cell];
      if (own.length > MARKS_PER_SIDE) own.shift(); // V2: the oldest vanishes after placing
      const marks = { ...s.marks, [side]: own } as VanishingState["marks"];
      const moves = [...s.moves, cell];
      const line = lineThrough(cellsOf({ marks }), cell, side);
      if (line)
        return {
          marks,
          toMove: side,
          moves,
          seen: s.seen,
          result: { kind: "win", winner: side, line },
        };
      const toMove = other(side);
      const key = positionKey(marks, toMove);
      const count = (s.seen[key] ?? 0) + 1;
      const seen = { ...s.seen, [key]: count };
      let result: Result | null = null;
      if (count >= options.repetitionLimit) result = { kind: "draw", reason: "repetition" };
      else if (moves.length >= options.maxPlies) result = { kind: "draw", reason: "ply-cap" };
      return { marks, toMove, moves, seen, result };
    },
    result: (s) => s.result,
    toMove: (s) => s.toMove,
    // The solving key ignores history: same marks, same ages, same side to move (V4).
    key: (s) => `${positionKey(s.marks, s.toMove)}${s.moves.length === 0 ? "|start" : ""}`,
  };
}

export const vanishing = createVanishing();

/** Vanishing without its history endings (V4, V5): the game graph the solver works on. */
export const pureVanishing = createVanishing({
  noEdgeOpening: true,
  repetitionLimit: Number.POSITIVE_INFINITY,
  maxPlies: Number.POSITIVE_INFINITY,
});

// Position rank for the shipped solution table (TTT-3.2): each side's marks, oldest first,
// as an ordered selection of 0–3 distinct cells (1 + 9 + 72 + 504 = 586 ranks), times the
// side to move. The empty board only occurs at the start, so no start flag is needed.
const LIST_OFFSET = [0, 1, 10, 82] as const;
const LIST_RANKS = 586;
export const VANISHING_RANKS = LIST_RANKS * LIST_RANKS * 2;

function listRank(cells: readonly number[]): number {
  let r = 0;
  let used = 0;
  cells.forEach((c, i) => {
    let below = 0; // unused cells smaller than c
    for (let k = 0; k < c; k++) if (!(used & (1 << k))) below++;
    r = r * (9 - i) + below;
    used |= 1 << c;
  });
  return (LIST_OFFSET[cells.length] as number) + r;
}

export function vanishingRank(s: Pick<VanishingState, "marks" | "toMove">): number {
  return (listRank(s.marks.X) * LIST_RANKS + listRank(s.marks.O)) * 2 + (s.toMove === "O" ? 1 : 0);
}
