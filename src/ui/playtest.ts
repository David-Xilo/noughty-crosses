// The playtest panel (only in playtest builds, VITE_PLAYTEST=1): records the session log in
// this device's storage and shows it on the title card, with Copy and New player buttons.
import { formatLog, type PlaytestEvent } from "../app/playtest-log";

const KEY = "ttt.playtest.v1";

interface Stored {
  startedAt: string; // local date and time, for the report
  origin: number; // Date.now() at the session start
  events: PlaytestEvent[];
}

type WithoutTime<E> = E extends unknown ? Omit<E, "t"> : never;
type NewEvent = WithoutTime<PlaytestEvent>;

function fresh(): Stored {
  const now = new Date();
  return {
    startedAt: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
    origin: Date.now(),
    events: [],
  };
}

const TYPES = new Set(["mode", "demo", "start", "refused", "end", "menu"]);

function load(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    if (raw && Array.isArray(raw.events) && typeof raw.origin === "number") {
      // Keep only events of a known type with a time; a broken entry is dropped.
      const events = raw.events.filter(
        (e) => e && TYPES.has(e.type) && typeof e.t === "number" && Number.isFinite(e.t),
      );
      return { startedAt: String(raw.startedAt ?? ""), origin: raw.origin, events };
    }
  } catch {
    // A broken log starts over; the facilitator's sheet is the backup.
  }
  return fresh();
}

export function createPlaytest(host: HTMLElement) {
  let log = load();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(log));
    } catch {
      // Storage blocked: the log lasts until the app closes.
    }
  };

  const panel = document.createElement("details");
  panel.className = "playtest";
  panel.innerHTML = `<summary>Playtest log</summary>
    <textarea readonly rows="8" aria-label="Playtest log"></textarea>
    <p class="actions">
      <button type="button" class="stamp small" data-act="copy">Copy</button>
      <button type="button" class="stamp small quiet" data-act="new">New player</button>
    </p>`;
  host.appendChild(panel);
  const text = panel.querySelector("textarea") as HTMLTextAreaElement;
  // The text is built only while the panel is open, not on every move during play.
  const show = () => {
    if (panel.open) text.value = formatLog(log.events, log.startedAt);
  };
  panel.addEventListener("toggle", show);

  const record = (e: NewEvent) => {
    log.events.push({ ...e, t: Date.now() - log.origin } as PlaytestEvent);
    save();
    show();
  };

  panel.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).dataset.act;
    if (act === "copy") {
      text.select();
      void navigator.clipboard?.writeText(text.value).catch(() => {
        // Without clipboard access the text stays selected for Ctrl+C.
      });
    }
    if (act === "new") {
      log = fresh();
      save();
      show();
    }
  });
  // Capture phase: read the button's action before the demo toggles Play and Pause.
  document.getElementById("demo")?.addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (b?.dataset.demo) record({ type: "demo", action: b.dataset.demo });
    },
    true,
  );
  show();
  return { record };
}

export type Playtest = ReturnType<typeof createPlaytest>;
