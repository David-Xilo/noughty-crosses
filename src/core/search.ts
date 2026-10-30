// Alpha-beta search for the line games (GDD §4.1, "Line games"): negamax with iterative
// deepening, a transposition table, threat checks and a threat-count evaluation (with a
// zugzwang term in Gravity). The
// budget is a node count, not a clock, so a seed gives the same move on every device
// (R6); the count is set so that a move takes well under 100 ms (research TTT-4.1.3).
import type { Level } from "./players";
import type { Rng } from "./rng";
import type { Mark, Side } from "./types";

/** A board where a move places a mark on an empty cell, and k in a row wins. */
export interface LineGame {
  readonly cells: number;
  readonly k: number;
  readonly lines: ReadonlyArray<readonly number[]>;
  /**
   * Gravity: the board's width. A move must then land on the lowest empty cell of its
   * column (row-major cells, row 0 at the top).
   */
  readonly width?: number;
}

export interface SearchLevel {
  /** The deepest iteration, in plies. */
  readonly depth: number;
  /** Root noise: any move within `noise` of the best score can be chosen. */
  readonly noise: number;
  /** The chance of not seeing the opponent's open three: a line one mark from complete. */
  readonly ignoreThreat: number;
  /**
   * Threat checks at every node: a win next move, a double threat (fork), a forced block.
   * Without them a level sees a fork only when its depth reaches the fork's last move.
   */
  readonly forks: boolean;
}

/** The levels of GDD §4.1: Casual depth 2, Keen depth 4, Sharp the full budget. */
export const SEARCH_LEVELS: Record<Level, SearchLevel> = {
  casual: { depth: 2, noise: 100, ignoreThreat: 0.3, forks: false },
  keen: { depth: 4, noise: 6, ignoreThreat: 0, forks: true },
  sharp: { depth: 64, noise: 0, ignoreThreat: 0, forks: true },
};

/** Nodes per move; a move stops at the last iteration that finished within it. */
const NODE_BUDGET = 40_000;

const WIN = 1_000_000;
const INF = 2 * WIN;
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const ABORT = new Error("node budget spent");
/** Folded into the key's low half when O is to move. */
const O_TO_MOVE = 0x2b5ad5b;

interface Entry {
  depth: number;
  value: number;
  flag: number;
  move: number;
}

/** Per game: the lines through each cell, and random keys for the transposition table. */
interface Tables {
  cellLines: number[][];
  /** Two 26-bit halves per cell and side: a 52-bit position key, exact in a double. */
  zHi: Int32Array;
  zLo: Int32Array;
}
const tables = new WeakMap<LineGame, Tables>();
function tablesOf(game: LineGame): Tables {
  let t = tables.get(game);
  if (t) return t;
  // A fixed generator (not the game's): the keys never touch the game's random sequence.
  let x = 0x9e3779b9;
  const next26 = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) & 0x3ffffff;
  };
  const zHi = Int32Array.from({ length: game.cells * 3 }, next26);
  const zLo = Int32Array.from({ length: game.cells * 3 }, next26);
  const cellLines = Array.from({ length: game.cells }, (_, c) =>
    game.lines.flatMap((l, i) => (l.includes(c) ? [i] : [])),
  );
  t = { cellLines, zHi, zLo };
  tables.set(game, t);
  return t;
}

/** Score of a line holding c marks of one side only: one mark 1, two 8, three 64. */
const WEIGHT = Int32Array.from({ length: 16 }, (_, c) => (c === 0 ? 0 : 8 ** (c - 1)));
/** Gravity: a column's lowest waiting three on its own side's rows (see `scan`). */
const ZUGZWANG = 200;

/**
 * The move for `toMove` at `level`: seeded by `rng`, which it advances by the same number
 * of draws on every device.
 */
export function searchMove(
  game: LineGame,
  cells: readonly Mark[],
  toMove: Side,
  level: SearchLevel,
  rng: Rng,
  budget = NODE_BUDGET,
): number {
  const { cellLines, zHi, zLo } = tablesOf(game);
  const { k, lines, width } = game;
  const n = game.cells;
  const board = new Int8Array(n); // 0 empty, 1 X, 2 O
  const count = new Int8Array(lines.length * 3); // per line: count[l * 3 + side]
  let hi = 0;
  let lo = 0;
  let filled = 0;
  const make = (c: number, p: number) => {
    board[c] = p;
    filled++;
    hi ^= zHi[c * 3 + p] as number;
    lo ^= zLo[c * 3 + p] as number;
    for (const l of cellLines[c] as number[]) count[l * 3 + p] = (count[l * 3 + p] as number) + 1;
  };
  const unmake = (c: number, p: number) => {
    board[c] = 0;
    filled--;
    hi ^= zHi[c * 3 + p] as number;
    lo ^= zLo[c * 3 + p] as number;
    for (const l of cellLines[c] as number[]) count[l * 3 + p] = (count[l * 3 + p] as number) - 1;
  };
  cells.forEach((m, i) => {
    if (m) make(i, m === "X" ? 1 : 2);
  });
  const me = toMove === "X" ? 1 : 2;
  /** An empty cell a move can take: in Gravity, only one resting on the bottom or a mark. */
  const playable = width
    ? (c: number) => board[c] === 0 && (c + width >= n || board[c + width] !== 0)
    : (c: number) => board[c] === 0;
  /** Did the mark just placed at `c` by `p` complete a line? */
  const wins = (c: number, p: number) => {
    for (const l of cellLines[c] as number[]) if (count[l * 3 + p] === k) return true;
    return false;
  };

  // Gravity: per column, the lowest waiting three (one whose last cell is not yet
  // playable) and its sides, as bits 1 << side: both sides can wait on one cell. The
  // lowest is reached first, so only it counts. On a board of
  // even height, once the columns fill, the side that moved first gets the odd rows from
  // the bottom and the other side the even rows (zugzwang): a lowest three waiting on its
  // own side's rows is worth ZUGZWANG (research TTT-4.1.4).
  const height = width ? n / width : 0;
  const lowest = new Int16Array(width ?? 0);
  const owner = new Int8Array(width ?? 0);
  const wait = (cell: number, side: number) => {
    const x = cell % (width as number);
    if (cell > (lowest[x] as number)) {
      lowest[x] = cell;
      owner[x] = 1 << side;
    } else if (cell === lowest[x]) owner[x] = (owner[x] as number) | (1 << side);
  };

  // One pass over the lines (scan) fills these: whether `p` wins next move, the cells
  // where the other side would (distinct, at most two; in Gravity the second can wait just
  // above the first), and the evaluation from p's side:
  // lines open to one side only, weighted by their marks. A line one mark short counts as
  // a win or a block only when its empty cell is playable (Gravity).
  const gap = (l: number) => {
    const line = lines[l] as readonly number[];
    let cell = line[0] as number;
    for (const c of line) if (board[c] === 0) cell = c;
    return cell;
  };
  let canWin = false;
  let blocks: number[] = [];
  let score = 0;
  const scan = (p: number) => {
    const q = 3 - p;
    canWin = false;
    blocks = [];
    score = 0;
    lowest.fill(-1);
    for (let l = 0; l < lines.length; l++) {
      const a = count[l * 3 + p] as number;
      const b = count[l * 3 + q] as number;
      if (b === 0) {
        score += WEIGHT[a] as number;
        if (a === k - 1) {
          const cell = gap(l);
          if (playable(cell)) canWin = true;
          else wait(cell, p);
        }
      } else if (a === 0) {
        score -= WEIGHT[b] as number;
        if (b === k - 1) {
          const cell = gap(l);
          if (!playable(cell)) wait(cell, q);
          else if (blocks.length < 2 && !blocks.includes(cell)) blocks.push(cell);
        }
      }
    }
    if (!width) return;
    // p moves now, so p moved first if an even number of cells is filled. One cell's row
    // belongs to one side only, so at most one side's three on it counts.
    const firstOdd = filled % 2 === 0;
    for (let x = 0; x < width; x++) {
      const c = lowest[x] as number;
      if (c < 0) continue;
      const oddRow = (height - Math.floor(c / width)) % 2 === 1;
      const side = oddRow === firstOdd ? p : q;
      if ((owner[x] as number) & (1 << side)) score += side === p ? ZUGZWANG : -ZUGZWANG;
    }
    // A three of q's waiting just above the only block wins right after it: a double threat.
    const block = blocks[0];
    if (blocks.length === 1 && block !== undefined && block >= width) {
      const above = block - width;
      if (lowest[above % width] === above && (owner[above % width] as number) & (1 << q))
        blocks.push(above);
    }
  };

  /**
   * Playable cells, the most promising first: lines they extend for either side.
   * `tiebreak` (the root only) orders equal cells by the seeded generator.
   */
  const ordered = (p: number, first: number, tiebreak?: () => number): number[] => {
    const q = 3 - p;
    const moves: number[] = [];
    const heat: number[] = [];
    for (let c = 0; c < n; c++) {
      if (!playable(c)) continue;
      let h = 0;
      for (const l of cellLines[c] as number[]) {
        const a = count[l * 3 + p] as number;
        const b = count[l * 3 + q] as number;
        if (b === 0) h += WEIGHT[a + 1] as number;
        if (a === 0) h += WEIGHT[b + 1] as number;
      }
      moves.push(c);
      heat[c] = c === first ? INF : h + (tiebreak ? tiebreak() : 0); // weights are whole
    }
    return moves.sort((x, y) => (heat[y] as number) - (heat[x] as number));
  };

  // A win or loss is stored as its distance from the position, not from the root, so a
  // transposition reached at another ply reads the right distance.
  const toTable = (v: number, ply: number) => (v > WIN / 2 ? v + ply : v < -WIN / 2 ? v - ply : v);
  const fromTable = (v: number, ply: number) =>
    v > WIN / 2 ? v - ply : v < -WIN / 2 ? v + ply : v;
  const table = new Map<number, Entry>();
  let nodes = 0;

  const negamax = (depth: number, alpha: number, beta: number, ply: number, p: number): number => {
    if (++nodes > budget) throw ABORT;
    const q = 3 - p;
    scan(p);
    // Threats first: a win now, a double threat against, or the one block that is forced.
    const against = level.forks ? blocks : [];
    if (level.forks) {
      if (canWin) return WIN - ply - 1;
      if (against.length === 2) return -(WIN - ply - 2);
    }
    if (depth === 0) return score;
    const key = hi * 0x4000000 + (p === 1 ? lo : lo ^ O_TO_MOVE);
    const hit = table.get(key);
    if (hit && hit.depth >= depth) {
      const v = fromTable(hit.value, ply);
      if (hit.flag === EXACT) return v;
      if (hit.flag === LOWER && v >= beta) return v;
      if (hit.flag === UPPER && v <= alpha) return v;
    }
    const moves = against.length === 1 ? against : ordered(p, hit ? hit.move : -1);
    const alpha0 = alpha;
    let best = -INF;
    let bestMove = moves[0] as number;
    for (const c of moves) {
      make(c, p);
      const v = wins(c, p)
        ? WIN - ply - 1
        : filled === n
          ? 0
          : -negamax(depth - 1, -beta, -alpha, ply + 1, q);
      unmake(c, p);
      if (v > best) {
        best = v;
        bestMove = c;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    const flag = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    table.set(key, { depth, value: toTable(best, ply), flag, move: bestMove });
    return best;
  };

  // The root. Casual can miss the opponent's open three: it then plays the best-looking
  // move by the evaluation alone, never one that blocks.
  scan(me);
  const against = blocks;
  if (!canWin && against.length > 0 && rng.next() < level.ignoreThreat) {
    const pool = ordered(me, -1).filter((c) => !against.includes(c));
    if (pool.length > 0) {
      const scored = pool.map((c) => {
        make(c, me);
        scan(me);
        unmake(c, me);
        return { c, v: score + level.noise * rng.next() };
      });
      return scored.reduce((a, b) => (b.v > a.v ? b : a)).c;
    }
  }

  let order = ordered(me, -1, () => rng.next());
  let done: Array<{ c: number; v: number; exact: boolean }> = [];
  const maxDepth = Math.min(level.depth, n - filled);
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const results: typeof done = [];
      let best = -INF;
      for (const c of order) {
        const alpha = best === -INF ? -INF : best - level.noise;
        make(c, me);
        const v = wins(c, me)
          ? WIN - 1
          : filled === n
            ? 0
            : -negamax(depth - 1, -INF, -alpha, 1, 3 - me);
        unmake(c, me);
        results.push({ c, v, exact: v > alpha });
        if (v > best) best = v;
      }
      done = results;
      order = [...results].sort((a, b) => b.v - a.v).map((r) => r.c);
      if (Math.abs(best) > WIN - 1000) break; // a forced result: deeper finds nothing new
    }
  } catch (e) {
    if (e !== ABORT) throw e;
  }
  if (done.length === 0) return order[0] as number;
  const best = Math.max(...done.map((r) => r.v));
  const pool = done.filter((r) => r.exact && r.v >= best - level.noise);
  if (level.noise === 0) return (pool[0] as { c: number }).c;
  return pool
    .map((r) => ({ c: r.c, v: r.v + level.noise * rng.next() }))
    .reduce((a, b) => (b.v > a.v ? b : a)).c;
}
