// The playtest log (design-process guideline, "Telemetry"): a few local, anonymous numbers
// per session, only in playtest builds (VITE_PLAYTEST=1). Times are milliseconds since the
// session started. No names, nothing sent anywhere: the facilitator copies the text.
import type { Level } from "../core/players";
import type { ModeId } from "./modes";

export type PlaytestEvent =
  | { t: number; type: "mode"; mode: ModeId }
  | { t: number; type: "demo"; action: string }
  | {
      t: number;
      type: "start";
      mode: ModeId;
      opponent: "computer" | "friend";
      level: Level;
      youFirst: boolean;
      /** Notakto only: the board count. */
      boards?: number;
      /** Ultimate only: whether the first four moves were random (U6). */
      fair?: boolean;
    }
  | {
      t: number;
      type: "refused";
      /**
       * `sent`: outside the board the last move sent to (U2); `closed`: a decided board (U3);
       * Three men's morris: `centre` the first move (TM1), `stuck` a piece that cannot move,
       * `pick` not one of the player's pieces, `slide` not a neighbouring empty cell (TM2);
       * Nesting: `hold` no piece held yet, `fit` a cell the piece held does not fit (NE2).
       */
      reason:
        | "edge"
        | "taken"
        | "full"
        | "dead"
        | "sent"
        | "closed"
        | "centre"
        | "stuck"
        | "pick"
        | "slide"
        | "hold"
        | "fit"
        | "wait";
    }
  | { t: number; type: "end"; result: string; moves: number; hint: boolean }
  | { t: number; type: "menu" };

const clock = (ms: number) => {
  const s = Math.floor(Math.max(0, ms) / 1000); // a clock set back never prints "-1:-5"
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const span = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};

/**
 * The first Vanishing game's result, and when the player chose Vanishing. `chosenAt` is null
 * when Vanishing was already selected, so no choice was seen; then the time counts from
 * the session start.
 */
function firstVanishing(events: readonly PlaytestEvent[]) {
  const chosen = events.find((e) => e.type === "mode" && e.mode === "vanishing");
  let inVanishing = false; // a game ended before this log started does not count
  for (const e of events) {
    if (e.type === "start") inVanishing = e.mode === "vanishing";
    if (e.type === "end" && inVanishing) {
      const from = chosen && chosen.t <= e.t ? chosen.t : null;
      return { chosenAt: from, endedAt: e.t, ms: e.t - (from ?? 0) };
    }
  }
  return null;
}

/** The log as plain text for the playtest report. */
export function formatLog(events: readonly PlaytestEvent[], startedAt: string): string {
  const lines = [`Noughty Crosses playtest log v1. Session started ${startedAt}.`];
  let game = 0;
  let gameStart = 0;
  let refused = 0;
  const refusedBy = {
    edge: 0,
    taken: 0,
    full: 0,
    dead: 0,
    sent: 0,
    closed: 0,
    centre: 0,
    stuck: 0,
    pick: 0,
    slide: 0,
    hold: 0,
    fit: 0,
    wait: 0,
  };
  for (const e of events) {
    const at = clock(e.t);
    if (e.type === "mode") lines.push(`${at} setup: chose ${e.mode}`);
    if (e.type === "demo") lines.push(`${at} demo: ${e.action}`);
    if (e.type === "menu") lines.push(`${at} back to the menu`);
    if (e.type === "start") {
      game++;
      gameStart = e.t;
      refused = 0;
      const who =
        e.opponent === "computer"
          ? `computer ${e.level}, player moves ${e.youFirst ? "first" : "second"}`
          : "friend";
      const boards = e.boards ? ` (${e.boards} board${e.boards > 1 ? "s" : ""})` : "";
      const fair = e.fair ? " (fair start)" : "";
      lines.push(`${at} game ${game} start: ${e.mode}${boards}${fair} vs ${who}`);
    }
    if (e.type === "refused" && e.reason in refusedBy) {
      refused++;
      refusedBy[e.reason]++;
      lines.push(`${at} refused move (${e.reason})`);
    }
    if (e.type === "end")
      lines.push(
        game === 0
          ? `${at} a game started before this log ended: ${e.result}, ${e.moves} moves`
          : `${at} game ${game} end: ${e.result}, ${e.moves} moves, ${span(e.t - gameStart)}, ` +
              `${refused} refused${e.hint ? ", hint shown" : ""}`,
      );
  }
  const fv = firstVanishing(events);
  lines.push(
    "Summary:",
    `- games: ${game}`,
    `- refused moves: ${Object.values(refusedBy).reduce((a, b) => a + b)} ` +
      `(edge ${refusedBy.edge}, taken ${refusedBy.taken}, full column ${refusedBy.full}, ` +
      `dead board ${refusedBy.dead}, other board ${refusedBy.sent}, ` +
      `closed board ${refusedBy.closed}, centre ${refusedBy.centre}, ` +
      `stuck piece ${refusedBy.stuck}, not your piece ${refusedBy.pick}, ` +
      `not a slide ${refusedBy.slide}, no piece held ${refusedBy.hold}, ` +
      `does not fit ${refusedBy.fit}, wait ${refusedBy.wait})`,
    !fv
      ? "- first Vanishing game: not finished"
      : fv.chosenAt === null
        ? `- first Vanishing game: Vanishing was already selected; first result at ` +
          `${clock(fv.endedAt)} (${span(fv.ms)} from the session start)`
        : `- first Vanishing game: chose Vanishing at ${clock(fv.chosenAt)}, first result at ` +
          `${clock(fv.endedAt)} (${span(fv.ms)})`,
  );
  return lines.join("\n");
}
