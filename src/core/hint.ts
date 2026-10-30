// The result-screen hint (GDD R9 and §4.2): the first move where the Sharp solver's value
// dropped for one side, and a move that would have kept it.
import { bestMovesBy, type Outcome, type Solution } from "./solver";
import type { Mode, Side } from "./types";

export interface Hint {
  /** The 1-based ply of the mistake. */
  readonly ply: number;
  readonly played: number;
  readonly better: number;
}

const score = (o: Outcome, side: Side) => (o === side ? 1 : o === "draw" ? 0 : -1);

/** The first ply where `side`'s move made its solved outcome worse, if any. */
export function firstMistake<S>(
  mode: Mode<S>,
  solution: Solution<S>,
  start: S,
  moves: readonly number[],
  side: Side,
): Hint | null {
  let s = start;
  for (let i = 0; i < moves.length; i++) {
    const cell = moves[i] as number;
    const next = mode.apply(s, cell);
    if (mode.toMove(s) === side) {
      const before = score(solution.value(s).outcome, side);
      const after = score(solution.value(next).outcome, side);
      if (after < before) {
        const [better] = bestMovesBy(mode, solution.value, s);
        return { ply: i + 1, played: cell, better: better as number };
      }
    }
    s = next;
  }
  return null;
}

/**
 * The first position where `side` had a forced win, if any. Vanishing's table ignores the
 * repetition and ply-cap draws (V4, V5), so a game drawn by them can hold a missed win
 * that `firstMistake` does not see.
 */
export function firstMissedWin<S>(
  mode: Mode<S>,
  solution: Solution<S>,
  start: S,
  moves: readonly number[],
  side: Side,
): Hint | null {
  let s = start;
  for (let i = 0; i < moves.length; i++) {
    const cell = moves[i] as number;
    if (mode.toMove(s) === side && solution.value(s).outcome === side) {
      const [better] = bestMovesBy(mode, solution.value, s);
      return { ply: i + 1, played: cell, better: better as number };
    }
    s = mode.apply(s, cell);
  }
  return null;
}
