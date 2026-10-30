// Progress, light (GDD §4.3): wins, draws and losses against the computer per mode and
// level, and the drawer's badge. Kept on this device only. No DOM here.
import type { Level } from "../core/players";
import { MODES, type ModeId } from "./modes";

type Outcome = "win" | "draw" | "loss";
type Counts = Record<Outcome, number>;
interface Progress {
  readonly version: 1;
  readonly counts: Partial<Record<ModeId, Partial<Record<Level, Counts>>>>;
}

export const NO_PROGRESS: Progress = { version: 1, counts: {} };
const ZERO: Counts = { win: 0, draw: 0, loss: 0 };
const LEVELS: readonly Level[] = ["casual", "keen", "sharp"];

export const countsOf = (p: Progress, mode: ModeId, level: Level): Counts =>
  p.counts[mode]?.[level] ?? ZERO;

export function addResult(p: Progress, mode: ModeId, level: Level, outcome: Outcome): Progress {
  const c = countsOf(p, mode, level);
  return {
    version: 1,
    counts: {
      ...p.counts,
      [mode]: { ...p.counts[mode], [level]: { ...c, [outcome]: c[outcome] + 1 } },
    },
  };
}

/** The drawer's badge: "beat Sharp" once the player has won against Sharp, else "drew Sharp". */
export function badge(p: Progress, mode: ModeId): "beat" | "drew" | null {
  const c = countsOf(p, mode, "sharp");
  return c.win ? "beat" : c.draw ? "drew" : null;
}

/** Reads stored progress; anything unreadable counts as none (only the counts are lost). */
export function readProgress(raw: unknown): Progress {
  const r = raw as { version?: unknown; counts?: Record<string, Record<string, unknown>> } | null;
  if (r?.version !== 1 || !r.counts || typeof r.counts !== "object") return NO_PROGRESS;
  const counts: Record<string, Record<string, Counts>> = {};
  for (const mode of Object.keys(MODES))
    for (const level of LEVELS) {
      const c = r.counts[mode]?.[level] as Record<string, unknown> | undefined;
      if (!c || typeof c !== "object") continue;
      const n = (o: Outcome) =>
        Number.isInteger(c[o]) && (c[o] as number) > 0 ? (c[o] as number) : 0;
      counts[mode] = {
        ...counts[mode],
        [level]: { win: n("win"), draw: n("draw"), loss: n("loss") },
      };
    }
  return { version: 1, counts };
}
