// Game-theoretic solver by retrograde analysis over the position graph.
// Works for acyclic modes (Classic) and cyclic ones (Vanishing): a position from which
// neither side can force a win is a draw. Used by tests, simulations and the "Sharp" level.
import type { Mode, Side } from "./types";
import { other } from "./types";

export type Outcome = Side | "draw";

export interface SolvedPosition {
  /** The result with perfect play from this position. */
  outcome: Outcome;
  /** Plies to the end with perfect play: fastest win, slowest loss; -1 for draws. */
  plies: number;
}

export interface Solution<S> {
  readonly positions: number;
  /** The longest forced win from any reachable position, in plies (justifies ply caps). */
  readonly longestForcedWin: number;
  value(state: S): SolvedPosition;
  /** Moves that keep the best outcome for the side to move (fastest win, slowest loss). */
  bestMoves(state: S): number[];
}

/**
 * Solves `mode` from one or more start positions (for example X first and O first). The
 * mode must not end games by history (repetition or caps).
 */
export function solve<S>(mode: Mode<S>, start: S | readonly S[]): Solution<S> {
  const index = new Map<string, number>();
  const mover: Side[] = [];
  const children: number[][] = [];
  const parents: number[][] = [];
  const outcome: (Outcome | undefined)[] = [];
  const plies: number[] = [];
  const queue: number[] = [];

  // 1. Enumerate every reachable position (breadth first).
  const states: S[] = [];
  for (const s of Array.isArray(start) ? (start as readonly S[]) : [start as S]) {
    if (index.has(mode.key(s))) continue;
    index.set(mode.key(s), states.length);
    states.push(s);
  }
  for (let n = 0; n < states.length; n++) {
    const s = states[n] as S;
    mover[n] = mode.toMove(s);
    parents[n] ??= [];
    const r = mode.result(s);
    if (r) {
      outcome[n] = r.kind === "win" ? r.winner : "draw";
      plies[n] = 0;
      children[n] = [];
      if (r.kind === "win") queue.push(n);
      continue;
    }
    const kids: number[] = [];
    for (const cell of mode.legalMoves(s)) {
      const next = mode.apply(s, cell);
      const key = mode.key(next);
      let c = index.get(key);
      if (c === undefined) {
        c = states.length;
        index.set(key, c);
        states.push(next);
      }
      kids.push(c);
      const ps = parents[c] ?? [];
      ps.push(n);
      parents[c] = ps;
    }
    children[n] = kids;
  }

  // 2. Retrograde: resolve wins and losses backwards from decided positions.
  const remaining = children.map((k) => k.length);
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q] as number;
    const o = outcome[c] as Side;
    for (const p of parents[c] ?? []) {
      if (outcome[p] !== undefined) continue;
      const pm = mover[p] as Side;
      if (o === pm) {
        outcome[p] = pm; // a move to a won position wins
        plies[p] = (plies[c] as number) + 1;
        queue.push(p);
      } else if (--(remaining[p] as number) === 0) {
        outcome[p] = other(pm); // every move loses
        plies[p] = Math.max(...(children[p] ?? []).map((k) => plies[k] as number)) + 1;
        queue.push(p);
      }
    }
  }

  const lookup = (state: S): SolvedPosition => {
    const n = index.get(mode.key(state));
    if (n === undefined) throw new Error(`position not reachable from start: ${mode.key(state)}`);
    const o = outcome[n];
    return o === undefined || o === "draw"
      ? { outcome: "draw", plies: -1 }
      : { outcome: o, plies: plies[n] as number };
  };

  let longestForcedWin = 0;
  for (let n = 0; n < states.length; n++) {
    if (outcome[n] !== undefined && outcome[n] !== "draw")
      longestForcedWin = Math.max(longestForcedWin, plies[n] as number);
  }

  return {
    positions: states.length,
    longestForcedWin,
    value: lookup,
    bestMoves: (state) => bestMovesBy(mode, lookup, state),
  };
}

/** Moves that keep the best outcome for the side to move: fastest win, slowest loss. */
export function bestMovesBy<S>(
  mode: Mode<S>,
  value: (state: S) => SolvedPosition,
  state: S,
): number[] {
  const side = mode.toMove(state);
  const rank = (v: SolvedPosition) =>
    v.outcome === side ? 1000 - v.plies : v.outcome === "draw" ? 0 : -1000 + v.plies;
  const scored = mode
    .legalMoves(state)
    .map((cell) => ({ cell, r: rank(value(mode.apply(state, cell))) }));
  const best = Math.max(...scored.map((m) => m.r));
  return scored.filter((m) => m.r === best).map((m) => m.cell);
}
