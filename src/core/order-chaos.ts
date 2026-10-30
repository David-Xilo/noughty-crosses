// Order and Chaos: a 6×6 board; on each turn the side to move places an X or an O; five of
// one mark in a row wins for Order, whoever placed it; Chaos wins once no five can be made
// (docs/gdd.md §3.8, rules OC1–OC5). The side that moves first is Order (OC1). The computer
// searches with its own alpha-beta (`orderChaosMove`), since a move helps or harms both
// marks' lines at once.
import type { ClassicState } from "./classic";
import type { Level, Player } from "./players";
import type { Rng } from "./rng";
import { linesOf, lineThrough, type Mark, type Mode, other, type Side } from "./types";

export const OC_SIZE = 6;
const OC_K = 5;
/** The 32 lines of five: twelve rows, twelve columns and eight diagonals. */
export const OC_LINES = linesOf(OC_SIZE, OC_SIZE, OC_K);
const N = OC_SIZE * OC_SIZE;

/** OC4: moves 0–35 place an X on that cell, 36–71 an O on cell move − 36. */
export const ocMove = (cell: number, mark: Side) => cell + (mark === "O" ? N : 0);
export const ocCell = (move: number) => move % N;
export const ocMark = (move: number): Side => (move < N ? "X" : "O");

export interface OrderChaosState extends ClassicState {
  /** The side playing Order: the side that moved first (OC1). */
  readonly order: Side;
}

/** OC3: a line of five can still be made while some line holds only one mark. */
export const fiveLeft = (cells: readonly Mark[]) =>
  OC_LINES.some((l) => !(l.some((c) => cells[c] === "X") && l.some((c) => cells[c] === "O")));

export const orderChaos: Mode<OrderChaosState> = {
  id: "order-chaos",
  cells: N,
  init: (first = "X") => ({
    cells: Array(N).fill(null),
    toMove: first,
    moves: [],
    result: null,
    order: first,
  }),
  legalMoves: (s) =>
    s.result ? [] : [0, N].flatMap((o) => s.cells.flatMap((m, i) => (m === null ? [i + o] : []))),
  apply(s, move) {
    if (s.result || !Number.isInteger(move) || move < 0 || move >= 2 * N) return s;
    const cell = ocCell(move);
    if (s.cells[cell] !== null) return s;
    const mark = ocMark(move);
    const cells = s.cells.slice();
    cells[cell] = mark;
    const moves = [...s.moves, move];
    const { order } = s;
    // OC2: five of one mark wins for Order, whoever placed it.
    const line = lineThrough(cells, cell, mark, OC_LINES);
    if (line)
      return {
        cells,
        toMove: s.toMove,
        moves,
        order,
        result: { kind: "win", winner: order, line },
      };
    // OC3: Chaos wins once every line holds both marks; a full board is one such case.
    if (!fiveLeft(cells))
      return {
        cells,
        toMove: s.toMove,
        moves,
        order,
        result: { kind: "win", winner: other(order), line: [] },
      };
    return { cells, toMove: other(s.toMove), moves, order, result: null };
  },
  result: (s) => s.result,
  toMove: (s) => s.toMove,
  key: (s) => `${s.cells.map((m) => m ?? ".").join("")}${s.toMove}${s.order}`,
};

// --- The computer (GDD §4.1, Order and Chaos) ------------------------------------------

interface OcLevel {
  /** The deepest iteration, in plies. */
  readonly depth: number;
  /** Root noise: any move within `noise` of the best score can be chosen. */
  readonly noise: number;
  /** Chaos: the chance of not seeing Order's four, a line one mark from five. */
  readonly ignoreThreat: number;
}

/** Casual looks one move ahead, Keen two, Sharp as deep as the node budget allows. */
export const OC_LEVELS: Record<Level, OcLevel> = {
  casual: { depth: 1, noise: 40, ignoreThreat: 0.3 },
  keen: { depth: 2, noise: 6, ignoreThreat: 0 },
  sharp: { depth: 64, noise: 0, ignoreThreat: 0 },
};

/** Nodes per move; a move stops at the last iteration that finished within it. */
const OC_BUDGET = 40_000;

const WIN = 1_000_000;
const INF = 2 * WIN;
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const ABORT = new Error("node budget spent");
const CHAOS_TO_MOVE = 0x2b5ad5b;
/**
 * A line holding c marks, all of one kind: what it is worth to Order, as each role's search
 * sees it. Chaos counts twos for less, so it spends its moves on threes (research
 * TTT-4.1.18, self-play).
 */
const ORDER_WEIGHT = [1, 4, 16, 64, 512, 0];
const CHAOS_WEIGHT = [1, 2, 8, 64, 512, 0];

const CELL_LINES = Array.from({ length: N }, (_, c) =>
  OC_LINES.flatMap((l, i) => (l.includes(c) ? [i] : [])),
);
const ZOBRIST = (() => {
  let x = 0x9e3779b9;
  const next26 = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) & 0x3ffffff;
  };
  return {
    hi: Int32Array.from({ length: N * 3 }, next26),
    lo: Int32Array.from({ length: N * 3 }, next26),
  };
})();

interface Entry {
  depth: number;
  value: number;
  flag: number;
  move: number;
}

/**
 * The move for the side to move, Order if `asOrder`, at `level`: seeded by `rng`, which it
 * advances by the same number of draws on every device. Scores are Order's: open lines,
 * weighted by their marks; Chaos plays to lower them.
 */
export function orderChaosMove(
  cells: readonly Mark[],
  asOrder: boolean,
  level: OcLevel,
  rng: Rng,
  budget = OC_BUDGET,
): number {
  const weight = asOrder ? ORDER_WEIGHT : CHAOS_WEIGHT;
  const board = new Int8Array(N); // 0 empty, 1 X, 2 O
  const count = new Int8Array(OC_LINES.length * 3);
  let hi = 0;
  let lo = 0;
  let score = OC_LINES.length * (weight[0] as number);
  let open = OC_LINES.length; // lines that hold one mark at most
  let fives = 0;
  const value = (a: number, b: number) => (a && b ? 0 : (weight[a + b] as number));
  const make = (c: number, p: number) => {
    board[c] = p;
    hi ^= ZOBRIST.hi[c * 3 + p] as number;
    lo ^= ZOBRIST.lo[c * 3 + p] as number;
    for (const l of CELL_LINES[c] as number[]) {
      const a = count[l * 3 + 1] as number;
      const b = count[l * 3 + 2] as number;
      count[l * 3 + p] = (count[l * 3 + p] as number) + 1;
      const a2 = count[l * 3 + 1] as number;
      const b2 = count[l * 3 + 2] as number;
      score += value(a2, b2) - value(a, b);
      if (!(a && b) && a2 && b2) open--;
      if (a2 === OC_K || b2 === OC_K) fives++;
    }
  };
  const unmake = (c: number, p: number) => {
    board[c] = 0;
    hi ^= ZOBRIST.hi[c * 3 + p] as number;
    lo ^= ZOBRIST.lo[c * 3 + p] as number;
    for (const l of CELL_LINES[c] as number[]) {
      const a = count[l * 3 + 1] as number;
      const b = count[l * 3 + 2] as number;
      if (a === OC_K || b === OC_K) fives--;
      count[l * 3 + p] = (count[l * 3 + p] as number) - 1;
      const a2 = count[l * 3 + 1] as number;
      const b2 = count[l * 3 + 2] as number;
      score += value(a2, b2) - value(a, b);
      if (a && b && !(a2 && b2)) open++;
    }
  };
  cells.forEach((m, i) => {
    if (m) make(i, m === "X" ? 1 : 2);
  });

  /**
   * Order's fours: the cells that complete five, as move numbers (cell and mark). A cell
   * can complete a five of each mark.
   */
  const fours = (): number[] => {
    const found: number[] = [];
    for (let l = 0; l < OC_LINES.length; l++) {
      const a = count[l * 3 + 1] as number;
      const b = count[l * 3 + 2] as number;
      if ((a === OC_K - 1 && b === 0) || (b === OC_K - 1 && a === 0)) {
        const gap = (OC_LINES[l] as number[]).find((c) => board[c] === 0) as number;
        const move = ocMove(gap, a ? "X" : "O");
        if (!found.includes(move)) found.push(move);
      }
    }
    return found;
  };
  /** Chaos's only answer to Order's fours: the other mark on their one cell, or none. */
  const block = (threats: number[]): number | null => {
    const four = threats[0] as number;
    if (threats.length > 1) return null;
    return ocMove(ocCell(four), ocMark(four) === "X" ? "O" : "X");
  };

  /** Every move, the most promising for the mover first, by the change in Order's score. */
  const ordered = (order: boolean, first: number, tiebreak?: () => number): number[] => {
    const moves: number[] = [];
    const heat: number[] = [];
    for (let c = 0; c < N; c++) {
      if (board[c] !== 0) continue;
      for (let p = 1; p <= 2; p++) {
        let d = 0;
        for (const l of CELL_LINES[c] as number[]) {
          const a = count[l * 3 + 1] as number;
          const b = count[l * 3 + 2] as number;
          d += (p === 1 ? value(a + 1, b) : value(a, b + 1)) - value(a, b);
        }
        const move = c + (p === 2 ? N : 0);
        moves.push(move);
        heat[move] = move === first ? INF : (order ? d : -d) + (tiebreak ? tiebreak() : 0);
      }
    }
    return moves.sort((x, y) => (heat[y] as number) - (heat[x] as number));
  };

  /** The value, for the mover, of the position after its move: a five, no five left, or open. */
  const ended = (order: boolean, ply: number): number | null => {
    if (fives > 0) return order ? WIN - ply - 1 : -(WIN - ply - 1);
    if (open === 0) return order ? -(WIN - ply - 1) : WIN - ply - 1;
    return null;
  };

  const toTable = (v: number, ply: number) => (v > WIN / 2 ? v + ply : v < -WIN / 2 ? v - ply : v);
  const fromTable = (v: number, ply: number) =>
    v > WIN / 2 ? v - ply : v < -WIN / 2 ? v + ply : v;
  const table = new Map<number, Entry>();
  let nodes = 0;

  const negamax = (
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
    order: boolean,
  ): number => {
    if (++nodes > budget) throw ABORT;
    // Threats first: Order completes a four now; Chaos blocks the one four, or loses to two.
    const threats = fours();
    let forced: number | null = null;
    if (threats.length > 0) {
      if (order) return WIN - ply - 1;
      forced = block(threats);
      if (forced === null) return -(WIN - ply - 2);
    }
    if (depth === 0) return order ? score : -score;
    const key = hi * 0x4000000 + (order ? lo : lo ^ CHAOS_TO_MOVE);
    const hit = table.get(key);
    if (hit && hit.depth >= depth) {
      const v = fromTable(hit.value, ply);
      if (hit.flag === EXACT) return v;
      if (hit.flag === LOWER && v >= beta) return v;
      if (hit.flag === UPPER && v <= alpha) return v;
    }
    const moves = forced !== null ? [forced] : ordered(order, hit ? hit.move : -1);
    const alpha0 = alpha;
    let best = -INF;
    let bestMove = moves[0] as number;
    for (const m of moves) {
      const c = ocCell(m);
      const p = m < N ? 1 : 2;
      make(c, p);
      const v = ended(order, ply) ?? -negamax(depth - 1, -beta, -alpha, ply + 1, !order);
      unmake(c, p);
      if (v > best) {
        best = v;
        bestMove = m;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    const flag = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    table.set(key, { depth, value: toTable(best, ply), flag, move: bestMove });
    return best;
  };

  // The root. Casual Chaos can miss Order's four: it then plays the best-looking other move.
  const threats = fours();
  if (asOrder && threats.length > 0) return threats[0] as number;
  const forced = asOrder ? null : threats.length > 0 ? block(threats) : null;
  if (forced !== null && rng.next() < level.ignoreThreat) {
    const pool = ordered(false, -1).filter((m) => m !== forced);
    const scored = pool.map((m) => {
      make(ocCell(m), m < N ? 1 : 2);
      const v = -score + level.noise * rng.next();
      unmake(ocCell(m), m < N ? 1 : 2);
      return { m, v };
    });
    if (scored.length > 0) return scored.reduce((a, b) => (b.v > a.v ? b : a)).m;
  }
  if (forced !== null) return forced;

  let order = ordered(asOrder, -1, () => rng.next());
  let done: Array<{ m: number; v: number; exact: boolean }> = [];
  const empty = cells.filter((m) => m === null).length;
  const maxDepth = Math.min(level.depth, empty);
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const results: typeof done = [];
      let best = -INF;
      for (const m of order) {
        const alpha = best === -INF ? -INF : best - level.noise;
        make(ocCell(m), m < N ? 1 : 2);
        const v = ended(asOrder, 0) ?? -negamax(depth - 1, -INF, -alpha, 1, !asOrder);
        unmake(ocCell(m), m < N ? 1 : 2);
        results.push({ m, v, exact: v > alpha });
        if (v > best) best = v;
      }
      done = results;
      order = [...results].sort((a, b) => b.v - a.v).map((r) => r.m);
      if (Math.abs(best) > WIN - 1000) break; // a forced result: deeper finds nothing new
    }
  } catch (e) {
    if (e !== ABORT) throw e;
  }
  if (done.length === 0) return order[0] as number;
  const best = Math.max(...done.map((r) => r.v));
  const pool = done.filter((r) => r.exact && r.v >= best - level.noise);
  if (level.noise === 0) return (pool[0] as { m: number }).m;
  return pool
    .map((r) => ({ m: r.m, v: r.v + level.noise * rng.next() }))
    .reduce((a, b) => (b.v > a.v ? b : a)).m;
}

/** The computer at `level` (GDD §4.1, Order and Chaos): its own alpha-beta, seeded by `rng`. */
export const orderChaosPlayer =
  (level: Level, rng: Rng): Player<OrderChaosState> =>
  (s) =>
    orderChaosMove(s.cells, s.toMove === s.order, OC_LEVELS[level], rng);
