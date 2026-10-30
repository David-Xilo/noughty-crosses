// A solution stored as a byte table indexed by a position rank (TTT-3.2), so the game can
// ship solved values instead of solving at load. One byte per rank: 0 unreachable, 1 draw,
// 2 + 2·plies for an X win, 3 + 2·plies for an O win.
import { bestMovesBy, type Solution, type SolvedPosition } from "./solver";
import type { Mode } from "./types";

/** A mode whose solution ships as a table (src/core/solved-tables.ts). */
export interface SolvedTable<S> {
  /** The file's name: public/assets/<id>_table.bin. */
  readonly id: string;
  readonly mode: Mode<S>;
  readonly rank: (state: S) => number;
  /** The number of ranks: the table's length in bytes. */
  readonly ranks: number;
  /** The positions the solve and the table start from. */
  readonly starts: readonly S[];
}

// biome-ignore lint/suspicious/noExplicitAny: the table check handles every table alike
export type AnySolvedTable = SolvedTable<any>;

function encodeValue(v: SolvedPosition): number {
  if (v.outcome === "draw") return 1;
  if (v.plies > 126) throw new Error(`plies out of range: ${v.plies}`);
  return 2 + 2 * v.plies + (v.outcome === "O" ? 1 : 0);
}

function decodeValue(b: number): SolvedPosition {
  if (b === 0) throw new Error("position not in the table");
  if (b === 1) return { outcome: "draw", plies: -1 };
  return { outcome: b % 2 === 0 ? "X" : "O", plies: (b - 2) >> 1 };
}

/**
 * The table of every position reachable from the starts, by rank.
 * @public tools/solve-tables.mjs loads it through Vite, which knip cannot follow.
 */
export function encodeTable<S>(t: SolvedTable<S>, value: (state: S) => SolvedPosition): Uint8Array {
  const table = new Uint8Array(t.ranks);
  const queue = [...t.starts];
  for (const s of queue) {
    const r = t.rank(s);
    if (table[r]) continue;
    table[r] = encodeValue(value(s));
    if (!t.mode.result(s)) for (const m of t.mode.legalMoves(s)) queue.push(t.mode.apply(s, m));
  }
  return table;
}

/** Refuses a table of the wrong length (a cut download) at load, not mid-game. */
export function tableSolution<S>(
  { id, mode, rank, ranks }: Pick<SolvedTable<S>, "id" | "mode" | "rank" | "ranks">,
  table: Uint8Array,
): Solution<S> {
  if (table.length !== ranks) throw new Error(`${id} table: ${table.length} bytes, not ${ranks}`);
  let positions = 0;
  let longestForcedWin = 0;
  for (const b of table) {
    if (b === 0) continue;
    positions++;
    if (b > 1) longestForcedWin = Math.max(longestForcedWin, (b - 2) >> 1);
  }
  const value = (state: S) => decodeValue(table[rank(state)] ?? 0);
  return {
    positions,
    longestForcedWin,
    value,
    bestMoves: (state) => bestMovesBy(mode, value, state),
  };
}
