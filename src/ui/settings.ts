// Player settings kept on this device (GDD §8). A missing or bad field falls back to its
// default, so settings stored by an older build still load. The language follows the
// browser until a second one ships (decision P9).
import type { Gfx } from "../scene/quality";
import { t } from "./l10n";

/** The actions whose keys the player can remap (GDD §5). */
export const ACTIONS = [
  "rotateLeft",
  "rotateRight",
  "tiltUp",
  "tiltDown",
  "resetCamera",
  "undo",
  "swapMark",
] as const;
export type Action = (typeof ACTIONS)[number];

export const DEFAULT_KEYS: Readonly<Record<Action, string>> = {
  rotateLeft: "q",
  rotateRight: "e",
  tiltUp: "PageUp",
  tiltDown: "PageDown",
  resetCamera: "r",
  undo: "u",
  swapMark: "m",
};

/**
 * Keys that keep their job: moving and choosing on the board (the standard board keys),
 * Tab, and Esc, which always goes back.
 */
export const FIXED_KEYS: readonly string[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "Enter",
  " ",
  "Tab",
  "Escape",
];

/**
 * Whether a key can take an action: a printable key or a named key that a keyboard sends
 * the same way every time, never a fixed key, a dead key or an input method's key.
 */
export function remappable(key: string): boolean {
  if (FIXED_KEYS.includes(key)) return false;
  return key.length === 1 || /^(F\d{1,2}|PageUp|PageDown|Insert|Delete|Backspace)$/.test(key);
}

interface Settings {
  gfx: Gfx | null; // null: choose from the device
  /** Volumes in percent, 0 to 100, in steps of 10. */
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  /** Music is off at the table unless this is on (style guide, "Sound"). */
  musicInPlay: boolean;
  /** Text size in percent, 100 to 200. */
  textSize: number;
  contrast: boolean;
  reducedMotion: boolean;
  /** Camera sensitivity in percent, 50 to 200. */
  cameraSpeed: number;
  haptics: boolean;
  keys: Record<Action, string>;
}

/** The defaults; contrast and reduced motion follow the OS when it says. */
function defaultSettings(os: { contrast: boolean; reducedMotion: boolean }): Settings {
  return {
    gfx: null,
    masterVolume: 100,
    musicVolume: 60,
    effectsVolume: 100,
    musicInPlay: false,
    textSize: 100,
    contrast: os.contrast,
    reducedMotion: os.reducedMotion,
    cameraSpeed: 100,
    haptics: true,
    keys: { ...DEFAULT_KEYS },
  };
}

/** A key as the settings keep it: letters in lower case, other keys by their name. */
export const normalKey = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

/** A key as the player reads it. */
export function keyLabel(key: string): string {
  return t("key-name", { key: key.length === 1 ? key.toUpperCase() : key });
}

const step = (x: unknown, min: number, max: number, by: number) =>
  typeof x === "number" && x >= min && x <= max && x % by === 0 ? x : null;

/** Actions added since keys were first stored: keys stored before them lack them. */
const NEW_ACTIONS: readonly Action[] = ["swapMark"];
const pick = <T>(o: Readonly<Record<Action, T>>, as: readonly Action[]) =>
  Object.fromEntries(as.map((a) => [a, o[a]]));

/**
 * Reads stored or imported settings over `base`. Keys are kept only as a whole set: one per
 * action, all different, none of them fixed.
 */
export function parseSettings(raw: unknown, base: Settings): Settings {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
  // An action newer than the stored keys (swapMark, TTT-4.1.15) takes its default key.
  const k =
    r.keys && typeof r.keys === "object"
      ? { ...pick(DEFAULT_KEYS, NEW_ACTIONS), ...(r.keys as Record<string, unknown>) }
      : null;
  const keys =
    k && ACTIONS.every((a) => typeof k[a] === "string" && k[a] !== "")
      ? (Object.fromEntries(ACTIONS.map((a) => [a, normalKey(k[a] as string)])) as Record<
          Action,
          string
        >)
      : null;
  const vals = keys ? Object.values(keys) : [];
  const keysOk = keys && new Set(vals).size === vals.length && vals.every(remappable);
  return {
    gfx: ["high", "low", "2d"].includes(r.gfx as string) ? (r.gfx as Gfx) : base.gfx,
    masterVolume: step(r.masterVolume, 0, 100, 10) ?? base.masterVolume,
    musicVolume: step(r.musicVolume, 0, 100, 10) ?? base.musicVolume,
    // Before TTT-4.1.9 a switch turned the effects off: it reads as an effects volume of 0.
    effectsVolume:
      step(r.effectsVolume, 0, 100, 10) ?? (r.sound === false ? 0 : base.effectsVolume),
    musicInPlay: bool(r.musicInPlay, base.musicInPlay),
    textSize: step(r.textSize, 100, 200, 25) ?? base.textSize,
    contrast: bool(r.contrast, base.contrast),
    reducedMotion: bool(r.reducedMotion, base.reducedMotion),
    cameraSpeed: step(r.cameraSpeed, 50, 200, 25) ?? base.cameraSpeed,
    haptics: bool(r.haptics, base.haptics),
    keys: keysOk && keys ? keys : { ...base.keys },
  };
}

const KEY = "ttt.settings.v1";

/** The stored settings, and whether there were any: none means a first launch. */
export function loadSettings(win: Window): { settings: Settings; stored: boolean } {
  const os = {
    contrast: win.matchMedia("(prefers-contrast: more)").matches,
    reducedMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  const base = defaultSettings(os);
  try {
    const text = localStorage.getItem(KEY);
    return { settings: parseSettings(JSON.parse(text ?? "null"), base), stored: text !== null };
  } catch {
    return { settings: base, stored: false };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage can be blocked (private windows); the setting then lasts for this visit only.
  }
}
