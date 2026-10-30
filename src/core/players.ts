// Pure move choosers: the computer levels of GDD §4.1 (small solved modes) and a seeded
// random player for simulations. Mistakes are seeded and layered on the solver.
import type { Rng } from "./rng";
import type { Solution } from "./solver";
import type { Mode } from "./types";

export type Player<S> = (state: S) => number;
export type Level = "casual" | "keen" | "sharp";

const pick = (moves: readonly number[], rng: Rng) => moves[rng.int(moves.length)] as number;

/** Moves that win at once for the side to move. */
export function winningMoves<S>(mode: Mode<S>, s: S): number[] {
  const side = mode.toMove(s);
  return mode.legalMoves(s).filter((m) => {
    const r = mode.result(mode.apply(s, m));
    return r?.kind === "win" && r.winner === side;
  });
}

/**
 * Moves that do not lose at once (Misère: completing your own line) and after which the
 * opponent cannot win at once (one-ply look-ahead, no forks).
 */
function safeMoves<S>(mode: Mode<S>, s: S): number[] {
  const side = mode.toMove(s);
  return mode.legalMoves(s).filter((m) => {
    const next = mode.apply(s, m);
    const r = mode.result(next);
    if (r) return r.kind === "draw" || r.winner === side;
    return winningMoves(mode, next).length === 0;
  });
}

/** A seeded random legal move. */
export function randomPlayer<S>(mode: Mode<S>, rng: Rng): Player<S> {
  return (s) => pick(mode.legalMoves(s), rng);
}

/** Perfect play ("Sharp", GDD §4.1): a seeded random choice among the best moves. */
function sharpPlayer<S>(solution: Solution<S>, rng: Rng): Player<S> {
  return (s) => pick(solution.bestMoves(s), rng);
}

/**
 * "Casual" (GDD §4.1): takes a win 80% of the time and blocks 60% of the time; otherwise
 * plays a random safe move. It never looks for forks. A skipped win or block is really
 * skipped: the fallback leaves out the moves it decided not to see.
 */
function casualPlayer<S>(mode: Mode<S>, rng: Rng): Player<S> {
  return (s) => {
    const legal = mode.legalMoves(s);
    const wins = winningMoves(mode, s);
    if (wins.length > 0 && rng.next() < 0.8) return pick(wins, rng);
    const others = legal.filter((m) => !wins.includes(m));
    const pool = others.length > 0 ? others : legal;
    const safe = safeMoves(mode, s).filter((m) => pool.includes(m));
    if (safe.length === pool.length) return pick(pool, rng); // nothing to block
    if (safe.length > 0 && rng.next() < 0.6) return pick(safe, rng); // blocks
    const unsafe = pool.filter((m) => !safe.includes(m));
    return pick(unsafe, rng); // misses the block
  };
}

/**
 * "Keen" (GDD §4.1): always takes a win and always blocks. Otherwise it plays perfectly,
 * except that 30% of the time it sees only one ply ahead and so misses a fork.
 */
function keenPlayer<S>(mode: Mode<S>, solution: Solution<S>, rng: Rng): Player<S> {
  return (s) => {
    const wins = winningMoves(mode, s);
    if (wins.length > 0) return pick(wins, rng);
    const safe = safeMoves(mode, s);
    if (safe.length > 0 && rng.next() < 0.3) return pick(safe, rng);
    return pick(solution.bestMoves(s), rng);
  };
}

/** The computer player for a level. */
export function levelPlayer<S>(
  level: Level,
  mode: Mode<S>,
  solution: Solution<S>,
  rng: Rng,
): Player<S> {
  if (level === "casual") return casualPlayer(mode, rng);
  if (level === "keen") return keenPlayer(mode, solution, rng);
  return sharpPlayer(solution, rng);
}
