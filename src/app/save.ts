// The autosave (GDD §8): one unfinished game, kept as its record and the generator's state,
// so a continued game plays on exactly as it would have (R6, R7). No DOM here; the storage
// is src/ui/store.ts.
import type { Level } from "../core/players";
import type { RngState } from "../core/rng";
import type { Side } from "../core/types";
import { Match, type Opponent, type Setup, type SidePref } from "./match";
import { MODES, type ModeId } from "./modes";

const SAVE_VERSION = 1;

interface SaveV1 {
  readonly version: 1;
  readonly setup: Setup;
  /** The side that moved first (R8). */
  readonly first: Side;
  readonly seed: number;
  readonly moves: readonly number[];
  /** The generator after the opening and the computer's moves so far (R6). */
  readonly rng: RngState;
}

export function toSave(m: Match): SaveV1 {
  const { setup, first, seed, moves } = m.record;
  return { version: SAVE_VERSION, setup, first, seed, moves, rng: m.rng };
}

const u32 = (x: unknown): x is number =>
  Number.isInteger(x) && (x as number) >= 0 && (x as number) < 2 ** 32;
const oneOf = <T extends string>(x: unknown, values: readonly T[]): x is T =>
  values.includes(x as T);

/** Older save versions become the current one here; version 1 is the first. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

/**
 * Reads a stored save: the game, ready to continue, or why it cannot be read. Every move
 * is replayed through the rules (R7), so a save with an illegal move is refused.
 */
export function readSave(raw: unknown): { match: Match } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "not a save" };
  let r = raw as Record<string, unknown>;
  for (let m = MIGRATIONS[Number(r.version)]; m; m = MIGRATIONS[Number(r.version)]) r = m(r);
  if (r.version !== SAVE_VERSION) return { error: `unknown version ${String(r.version)}` };
  const s = r.setup as Record<string, unknown> | null;
  if (
    !s ||
    typeof s !== "object" ||
    !oneOf<ModeId>(s.mode, Object.keys(MODES) as ModeId[]) ||
    !oneOf<Opponent>(s.opponent, ["computer", "friend"]) ||
    !oneOf<Level>(s.level, ["casual", "keen", "sharp"]) ||
    !oneOf<SidePref>(s.side, ["first", "second", "alternate"]) ||
    !(Number.isInteger(s.boards) && (s.boards as number) >= 1 && (s.boards as number) <= 3) ||
    typeof s.fair !== "boolean"
  )
    return { error: "bad setup" };
  if (!oneOf<Side>(r.first, ["X", "O"]) || !u32(r.seed)) return { error: "bad start" };
  const moves = r.moves;
  const rng = r.rng;
  if (!Array.isArray(moves) || !moves.every((c) => Number.isInteger(c) && c >= 0))
    return { error: "bad moves" };
  if (!Array.isArray(rng) || rng.length !== 4 || !rng.every(u32)) return { error: "bad rng" };
  const setup: Setup = {
    mode: s.mode,
    opponent: s.opponent,
    level: s.level,
    side: s.side,
    boards: s.boards as number,
    fair: s.fair,
  };
  const match = new Match(setup, r.seed, r.first);
  for (const c of moves) if (!match.play(c)) return { error: `illegal move ${c}` };
  match.resumed(rng as unknown as RngState);
  return { match };
}
