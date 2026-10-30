// Nesting: each side has six pieces in three sizes; a move places one from the reserve or
// moves one of the side's top pieces, onto an empty cell or over a smaller piece; only top
// pieces count, and three in a row wins (docs/gdd.md §3.8, rules NE1–NE6). Lifting a piece
// that uncovers the other side's line loses, unless the piece covers that line again (NE4).
// Repeats and the ply cap end games by history (NE5). The game is too big to ship solved,
// so the computer searches with its own alpha-beta (`nestingMove`).
import type { Level, Player } from "./players";
import type { Rng } from "./rng";
import { LINES_3x3, type Mark, type Mode, other, type Result, type Side } from "./types";

/** NE1: small, medium, large; two of each per side. */
export const SIZES = 3;
const PER_SIZE = 2;
const PLACES = SIZES * 9;

/** NE6: moves 0–26 place a piece of `size` from the reserve on `cell`: size × 9 + cell. */
export const placeMove = (size: number, cell: number) => size * 9 + cell;
/** NE6: moves 27–107 move a top piece: 27 + from × 9 + to. */
export const shiftMove = (from: number, to: number) => PLACES + from * 9 + to;
export const isShift = (move: number) => move >= PLACES;
export const shiftFrom = (move: number) => Math.floor((move - PLACES) / 9);
/** The cell a move puts its piece on. */
export const nestLanding = (move: number) => (isShift(move) ? (move - PLACES) % 9 : move % 9);
/** The reserve size a placement takes. */
export const placeSize = (move: number) => Math.floor(move / 9);

const POW = [1, 3, 9] as const;
/**
 * A cell is one number: per size, 0 none, 1 X or 2 O, as base-3 digits (small first). A
 * stack holds at most one piece of each size, since a piece only covers a smaller one.
 */
const ownerAt = (cell: number, size: number) => Math.floor(cell / (POW[size] as number)) % 3;
const sideCode = (s: Side) => (s === "X" ? 1 : 2);

/** The size of a cell's top piece, or -1 when it is empty. */
function topSize(cell: number): number {
  for (let z = SIZES - 1; z >= 0; z--) if (ownerAt(cell, z)) return z;
  return -1;
}
/** The side of a cell's top piece (NE3). */
const topSide = (cell: number): Mark => {
  const z = topSize(cell);
  return z < 0 ? null : ownerAt(cell, z) === 1 ? "X" : "O";
};

interface NestingOptions {
  /** NE5: the game is drawn on this occurrence of the same position. */
  readonly repetitionLimit: number;
  /** NE5: the game is drawn after this many plies without a winner. */
  readonly maxPlies: number;
}

export const NESTING_RULES: NestingOptions = { repetitionLimit: 3, maxPlies: 60 };

export interface NestingState {
  /** Per cell its stack, as base-3 digits per size (`ownerAt`). */
  readonly stacks: readonly number[];
  readonly toMove: Side;
  readonly moves: readonly number[];
  /** How often each position key has occurred, including the current one (NE5). */
  readonly seen: Readonly<Record<string, number>>;
  readonly result: Result | null;
}

/** The top pieces' sides: what the board shows and what makes a line (NE3). */
export const nestTops = (s: Pick<NestingState, "stacks">): Mark[] => s.stacks.map(topSide);
/** The top pieces' sizes, -1 for an empty cell. */
export const nestSizes = (s: Pick<NestingState, "stacks">): number[] => s.stacks.map(topSize);

/** How many pieces of `size` `side` still has in its reserve (NE1). */
export function reserveOf(s: Pick<NestingState, "stacks">, side: Side, size: number): number {
  const p = sideCode(side);
  return PER_SIZE - s.stacks.filter((c) => ownerAt(c, size) === p).length;
}

const lineOf = (tops: readonly Mark[], side: Side) =>
  LINES_3x3.find((l) => l.every((i) => tops[i] === side)) ?? null;

/** A position: every stack and the side to move; the reserves follow from the stacks. */
const boardKey = (stacks: readonly number[], toMove: Side) =>
  `${stacks.map((c) => c.toString(27)).join("")}${toMove}`;

export function createNesting(options: NestingOptions = NESTING_RULES): Mode<NestingState> {
  const legalMoves = (s: NestingState): number[] => {
    if (s.result) return [];
    const p = sideCode(s.toMove);
    const tops = s.stacks.map(topSize);
    const moves: number[] = [];
    // NE2: a piece from the reserve, on an empty cell or over a smaller piece.
    for (let z = 0; z < SIZES; z++) {
      if (reserveOf(s, s.toMove, z) === 0) continue;
      for (let c = 0; c < 9; c++) if ((tops[c] as number) < z) moves.push(placeMove(z, c));
    }
    // NE2: one of the side's top pieces, to another cell where it fits.
    for (let a = 0; a < 9; a++) {
      const z = tops[a] as number;
      if (z < 0 || ownerAt(s.stacks[a] as number, z) !== p) continue;
      for (let b = 0; b < 9; b++)
        if (b !== a && (tops[b] as number) < z) moves.push(shiftMove(a, b));
    }
    return moves;
  };

  return {
    id: options === NESTING_RULES ? "nesting" : "nesting-variant",
    cells: 9,
    init(first = "X") {
      const stacks: number[] = Array(9).fill(0);
      return {
        stacks,
        toMove: first,
        moves: [],
        seen: { [boardKey(stacks, first)]: 1 },
        result: null,
      };
    },
    legalMoves,
    apply(s, move) {
      if (!legalMoves(s).includes(move)) return s; // R2
      const side = s.toMove;
      const p = sideCode(side);
      const stacks = s.stacks.slice();
      let size: number;
      if (isShift(move)) {
        const from = shiftFrom(move);
        size = topSize(stacks[from] as number);
        stacks[from] = (stacks[from] as number) - p * (POW[size] as number);
      } else size = placeSize(move);
      const to = nestLanding(move);
      stacks[to] = (stacks[to] as number) + p * (POW[size] as number);
      const moves = [...s.moves, move];
      // NE4: the other side's line, uncovered and not covered again, wins for it; else the
      // mover's own line wins.
      const tops = stacks.map(topSide);
      const theirs = lineOf(tops, other(side));
      const mine = theirs ? null : lineOf(tops, side);
      if (theirs || mine) {
        const winner = theirs ? other(side) : side;
        const result: Result = { kind: "win", winner, line: (theirs ?? mine) as readonly number[] };
        return { stacks, toMove: side, moves, seen: s.seen, result };
      }
      // NE2 leaves a move for every side: a large piece always has a cell to go to.
      const toMove = other(side);
      const key = boardKey(stacks, toMove);
      const seen = { ...s.seen, [key]: (s.seen[key] ?? 0) + 1 };
      let result: Result | null = null;
      if ((seen[key] as number) >= options.repetitionLimit)
        result = { kind: "draw", reason: "repetition" };
      else if (moves.length >= options.maxPlies) result = { kind: "draw", reason: "ply-cap" };
      return { stacks, toMove, moves, seen, result };
    },
    result: (s) => s.result,
    toMove: (s) => s.toMove,
    key: (s) => boardKey(s.stacks, s.toMove),
  };
}

export const nesting = createNesting();

// --- The computer (GDD §4.1, Nesting) ---------------------------------------------------

interface NestLevel {
  /** The deepest iteration, in plies. */
  readonly depth: number;
  /** Root noise: any move within `noise` of the best score can be chosen. */
  readonly noise: number;
  /** The chance of looking one ply only, and so not seeing the other side's reply. */
  readonly shortSight: number;
}

/** Casual looks two plies ahead, Keen four, Sharp as deep as the node budget allows. */
export const NEST_LEVELS: Record<Level, NestLevel> = {
  casual: { depth: 2, noise: 40, shortSight: 0.3 },
  keen: { depth: 4, noise: 4, shortSight: 0 },
  sharp: { depth: 64, noise: 0, shortSight: 0 },
};

/** Nodes per move; a move stops at the last iteration that finished within it. */
const NEST_BUDGET = 20_000;

const WIN = 1_000_000;
const INF = 2 * WIN;
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const ABORT = new Error("node budget spent");
const O_TO_MOVE = 0x2b5ad5b;

const LINE_MASKS = LINES_3x3.map((l) => l.reduce((m, i) => m | (1 << i), 0));
/** Per 9-bit mask: whether it holds a line. */
const HAS_LINE = Uint8Array.from({ length: 512 }, (_, m) =>
  LINE_MASKS.some((l) => (m & l) === l) ? 1 : 0,
);
const POP = Uint8Array.from({ length: 512 }, (_, m) => {
  let c = 0;
  for (let x = m; x; x &= x - 1) c++;
  return c;
});
/** Per line, the value of holding 1, 2 or 3 of its tops, the other side holding none. */
const LINE_WEIGHT = [0, 2, 12, 0];
/** A top piece by size: a large one cannot be covered, a small one is easy to cover. */
const TOP_WEIGHT = [1, 2, 4];
/** The side to move can complete a line now; the other side has two cells to complete one. */
const THREAT = 500;
const FORK = 400;
const ZOBRIST = (() => {
  let x = 0x9e3779b9;
  const next26 = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) & 0x3ffffff;
  };
  // Per side, size and cell.
  return {
    hi: Int32Array.from({ length: 2 * SIZES * 9 }, next26),
    lo: Int32Array.from({ length: 2 * SIZES * 9 }, next26),
  };
})();

interface Entry {
  depth: number;
  value: number;
  flag: number;
  move: number;
}

/**
 * The move for the side to move at `level`: seeded by `rng`, which it advances by the same
 * number of draws on every device. A position seen twice in the game, or once on the search's
 * own path, counts as a draw, and so does reaching the ply cap (NE5).
 */
export function nestingMove(s: NestingState, level: NestLevel, rng: Rng, budget = NEST_BUDGET) {
  // masks[side * 3 + size]: the cells holding that side's piece of that size; side 0 is X.
  const masks = new Int32Array(2 * SIZES);
  let hi = 0;
  let lo = 0;
  const flip = (p: number, z: number, c: number) => {
    const k = (p * SIZES + z) * 9 + c;
    masks[p * SIZES + z] = (masks[p * SIZES + z] as number) ^ (1 << c);
    hi ^= ZOBRIST.hi[k] as number;
    lo ^= ZOBRIST.lo[k] as number;
  };
  s.stacks.forEach((cell, c) => {
    for (let z = 0; z < SIZES; z++) {
      const o = ownerAt(cell, z);
      if (o) flip(o - 1, z, c);
    }
  });
  /** Cells holding a piece of `size` or larger, of either side. */
  const atLeast = (z: number) => {
    let m = 0;
    for (let y = z; y < SIZES; y++) m |= (masks[y] as number) | (masks[SIZES + y] as number);
    return m;
  };
  /** Side p's top pieces, as a mask (NE3). */
  const tops = (p: number) => {
    let covered = 0;
    let mine = 0;
    for (let z = SIZES - 1; z >= 0; z--) {
      mine |= (masks[p * SIZES + z] as number) & ~covered;
      covered |= (masks[z] as number) | (masks[SIZES + z] as number);
    }
    return mine;
  };
  const sizeOfTop = (c: number) => {
    const bit = 1 << c;
    for (let z = SIZES - 1; z >= 0; z--)
      if (((masks[z] as number) | (masks[SIZES + z] as number)) & bit) return z;
    return -1;
  };

  /** Side p's legal moves (NE2), in the rules core's order. */
  const movesOf = (p: number): number[] => {
    const out: number[] = [];
    for (let z = 0; z < SIZES; z++) {
      const free = ~atLeast(z) & 511;
      if ((POP[masks[p * SIZES + z] as number] as number) < PER_SIZE)
        for (let c = 0; c < 9; c++) if (free & (1 << c)) out.push(placeMove(z, c));
    }
    const mine = tops(p);
    for (let a = 0; a < 9; a++) {
      if (!(mine & (1 << a))) continue;
      const free = ~atLeast(sizeOfTop(a)) & 511;
      for (let b = 0; b < 9; b++) if (free & (1 << b)) out.push(shiftMove(a, b));
    }
    return out;
  };
  /** Plays `move` for p; returns what `undo` needs: the size moved and the source cell. */
  const make = (p: number, move: number): number => {
    if (isShift(move)) {
      const from = shiftFrom(move);
      const z = sizeOfTop(from);
      flip(p, z, from);
      flip(p, z, nestLanding(move));
      return z;
    }
    flip(p, placeSize(move), nestLanding(move));
    return placeSize(move);
  };
  const unmake = (p: number, move: number, z: number) => {
    flip(p, z, nestLanding(move));
    if (isShift(move)) flip(p, z, shiftFrom(move));
  };
  /** After p's move: +1 p wins, −1 p loses (an uncovered line, NE4), 0 neither. */
  const ended = (p: number) => {
    if (HAS_LINE[tops(1 - p)]) return -1;
    return HAS_LINE[tops(p)] ? 1 : 0;
  };
  /**
   * The position for p, to move: open lines weighted by their tops, and the tops by size. A
   * line of two whose third cell p can take with a larger piece wins next move; two such
   * cells of the other side's can rarely both be stopped.
   */
  const bySize = new Int32Array(2 * SIZES);
  const evaluate = (p: number) => {
    let v = 0;
    let covered = 0;
    for (let z = SIZES - 1; z >= 0; z--) {
      const mine = (masks[p * SIZES + z] as number) & ~covered;
      const theirs = (masks[(1 - p) * SIZES + z] as number) & ~covered;
      bySize[z] = mine;
      bySize[SIZES + z] = theirs;
      v += (TOP_WEIGHT[z] as number) * ((POP[mine] as number) - (POP[theirs] as number));
      covered |= mine | theirs;
    }
    const a = (bySize[0] as number) | (bySize[1] as number) | (bySize[2] as number);
    const b = (bySize[3] as number) | (bySize[4] as number) | (bySize[5] as number);
    /** The largest piece side s (0 p, 1 the other) can bring from outside `line`, or −1. */
    const reach = (side: number, line: number) => {
      const q = side === 0 ? p : 1 - p;
      for (let z = SIZES - 1; z >= 0; z--) {
        if ((POP[masks[q * SIZES + z] as number] as number) < PER_SIZE) return z;
        if ((bySize[side * SIZES + z] as number) & ~line) return z;
      }
      return -1;
    };
    const topAt = (cell: number) => {
      for (let z = SIZES - 1; z >= 0; z--)
        if (((bySize[z] as number) | (bySize[SIZES + z] as number)) & cell) return z;
      return -1;
    };
    let threats = 0;
    for (const l of LINE_MASKS) {
      const x = POP[a & l] as number;
      const y = POP[b & l] as number;
      if (x === 2) {
        const gap = l & ~a;
        if (reach(0, l) > topAt(gap)) return THREAT;
      }
      if (y === 2) {
        const gap = l & ~b;
        if (reach(1, l) > topAt(gap)) threats |= gap;
      }
      if (y === 0) v += LINE_WEIGHT[x] as number;
      else if (x === 0) v -= LINE_WEIGHT[y] as number;
    }
    return (POP[threats] as number) >= 2 ? -FORK : v;
  };

  const key = (p: number) => hi * 0x4000000 + (p === 0 ? lo : lo ^ O_TO_MOVE);
  // NE5: positions the game has already seen twice draw at once; the search's own path too.
  const history = new Set<number>();
  const plyLeft = NESTING_RULES.maxPlies - s.moves.length;
  const path: number[] = [];
  {
    // The game's keys are strings; the search's are numbers. Replaying the moves is cheap.
    let state = nesting.init(s.moves.length % 2 === 0 ? s.toMove : other(s.toMove));
    const counts = new Map<number, number>();
    const save = { hi, lo, masks: masks.slice() };
    masks.fill(0);
    hi = lo = 0;
    const count = (p: number) => {
      const k = key(p);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    };
    count(sideCode(state.toMove) - 1);
    for (const m of s.moves) {
      make(sideCode(state.toMove) - 1, m);
      state = nesting.apply(state, m);
      count(sideCode(state.toMove) - 1);
    }
    for (const [k, n] of counts) if (n >= NESTING_RULES.repetitionLimit - 1) history.add(k);
    hi = save.hi;
    lo = save.lo;
    masks.set(save.masks);
  }

  const toTable = (v: number, ply: number) => (v > WIN / 2 ? v + ply : v < -WIN / 2 ? v - ply : v);
  const fromTable = (v: number, ply: number) =>
    v > WIN / 2 ? v - ply : v < -WIN / 2 ? v + ply : v;
  const table = new Map<number, Entry>();
  let nodes = 0;

  /**
   * Moves for p, the TT move first, then those that win at once, then larger pieces and
   * covers of the other side's pieces. `tiebreak` (the root only) orders equal moves by
   * the seeded generator.
   */
  const ordered = (p: number, first: number, tiebreak?: () => number): number[] => {
    const moves = movesOf(p);
    const heat: number[] = [];
    const theirs = tops(1 - p);
    for (const m of moves) {
      const z = make(p, m);
      const e = ended(p);
      unmake(p, m, z);
      const covers = theirs & (1 << nestLanding(m)) ? 4 : 0;
      heat[m] = m === first ? INF : e * WIN + covers + z + (tiebreak ? tiebreak() : 0);
    }
    return moves.sort((x, y) => (heat[y] as number) - (heat[x] as number));
  };

  const negamax = (depth: number, alpha: number, beta: number, ply: number, p: number): number => {
    if (++nodes > budget) throw ABORT;
    const k = key(p);
    if (history.has(k) || path.includes(k) || ply >= plyLeft) return 0;
    if (depth === 0) return evaluate(p);
    const hit = table.get(k);
    if (hit && hit.depth >= depth) {
      const v = fromTable(hit.value, ply);
      if (hit.flag === EXACT) return v;
      if (hit.flag === LOWER && v >= beta) return v;
      if (hit.flag === UPPER && v <= alpha) return v;
    }
    const moves = ordered(p, hit ? hit.move : -1);
    const alpha0 = alpha;
    let best = -INF;
    let bestMove = moves[0] as number;
    path.push(k);
    for (const m of moves) {
      const z = make(p, m);
      const e = ended(p);
      const v = e ? e * (WIN - ply - 1) : -negamax(depth - 1, -beta, -alpha, ply + 1, 1 - p);
      unmake(p, m, z);
      if (v > best) {
        best = v;
        bestMove = m;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    path.pop();
    const flag = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    table.set(k, { depth, value: toTable(best, ply), flag, move: bestMove });
    return best;
  };

  // The root: Casual sometimes looks one ply only, and misses the other side's reply.
  const me = sideCode(s.toMove) - 1;
  const maxDepth = rng.next() < level.shortSight ? 1 : level.depth;
  let order = ordered(me, -1, () => rng.next());
  let done: Array<{ m: number; v: number; exact: boolean }> = [];
  path.push(key(me));
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const results: typeof done = [];
      let best = -INF;
      for (const m of order) {
        const alpha = best === -INF ? -INF : best - level.noise;
        const z = make(me, m);
        const e = ended(me);
        const v = e ? e * (WIN - 1) : -negamax(depth - 1, -INF, -alpha, 1, 1 - me);
        unmake(me, m, z);
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

/** The computer at `level` (GDD §4.1, Nesting): its own alpha-beta, seeded by `rng`. */
export const nestingPlayer =
  (level: Level, rng: Rng): Player<NestingState> =>
  (s) =>
    nestingMove(s, NEST_LEVELS[level], rng);
