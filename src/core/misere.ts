// Misère: Classic, except that completing three of your own in a row loses (docs/gdd.md
// §3.3, rules M1–M3). It shares Classic's state and position rank.
import { type ClassicState, classic } from "./classic";
import { type Mode, other } from "./types";

export const misere: Mode<ClassicState> = {
  ...classic,
  id: "misere",
  apply(s, cell) {
    const next = classic.apply(s, cell);
    if (next === s) return s; // R2: illegal, or the game is over
    const r = next.result;
    // M2: the line is the mover's own, and the other side wins.
    return r?.kind === "win" ? { ...next, result: { ...r, winner: other(r.winner) } } : next;
  },
};
