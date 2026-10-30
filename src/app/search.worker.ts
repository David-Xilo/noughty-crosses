// The searching computers (the line games' alpha-beta, Overtime, Cube, Order and Chaos,
// Nesting, Ultimate's MCTS), off the main thread (GDD §4.1, §11): one search per message. The generator's state goes in and comes
// back, so the moves are the same as a search on the main thread with the game's
// generator (R6).
import { bigBoardPlayer } from "../core/bigboard";
import type { ClassicState } from "../core/classic";
import { cubePlayer } from "../core/cube";
import { gravityPlayer } from "../core/gravity";
import { ultimatePlayer } from "../core/mcts";
import { type NestingState, nestingPlayer } from "../core/nesting";
import { orderChaosPlayer } from "../core/order-chaos";
import { overtimePlayer } from "../core/overtime";
import type { Level, Player } from "../core/players";
import { createRng, type Rng, type RngState } from "../core/rng";
import type { UltimateState } from "../core/ultimate";

const PLAYERS = {
  bigboard: bigBoardPlayer,
  overtime: overtimePlayer,
  gravity: gravityPlayer,
  ultimate: ultimatePlayer,
  cube: cubePlayer,
  "order-chaos": orderChaosPlayer,
  nesting: nestingPlayer,
};
export type SearchMode = keyof typeof PLAYERS;
export type SearchState = ClassicState | UltimateState | NestingState;

export interface SearchRequest {
  readonly id: number;
  readonly mode: SearchMode;
  readonly state: SearchState;
  readonly level: Level;
  readonly rng: RngState;
}

export interface SearchReply {
  readonly id: number;
  readonly move: number;
  readonly rng: RngState;
  /** The search's time in this worker, for the on-device check (?search=1). */
  readonly ms: number;
}

self.onmessage = (e: MessageEvent<SearchRequest>) => {
  const { id, mode, state, level, rng } = e.data;
  const r = createRng(rng);
  const start = performance.now();
  // Each mode's player gets its own mode's state.
  const player = PLAYERS[mode] as (level: Level, rng: Rng) => Player<SearchState>;
  const move = player(level, r)(state);
  const reply: SearchReply = { id, move, rng: r.state(), ms: performance.now() - start };
  postMessage(reply);
};
