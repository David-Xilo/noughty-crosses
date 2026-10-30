// The game's screens (GDD §6, TTT-4.1.6): the cabinet title, the mode drawers, rule cards,
// setup, the table, pause, result, settings and credits, with the autosave and progress
// (§4.3, §8). Fourteen modes, against a friend or the computer. The DOM is ready at once; the
// 3D table loads behind it (render on demand), or never in the 2D setting. Input (§5,
// TTT-4.1.7): mouse, keyboard with remappable keys, and a controller; undo and the camera.
// Every string is a Fluent message (§10, TTT-4.1.8): src/ui/locales/en.ftl.
import "@fontsource-variable/fraunces";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./ui/style.css";
import { HUMAN, Match, type Setup } from "./app/match";
import { type AnyModeInfo, MODES, type ModeId } from "./app/modes";
import { addResult, badge, countsOf, NO_PROGRESS, readProgress } from "./app/progress";
import { readSave, toSave } from "./app/save";
import { CENTRE, isSlide, slideFrom, slideMove, slideTo } from "./core/morris";
import {
  isShift,
  nestLanding,
  placeMove,
  placeSize,
  SIZES,
  shiftFrom,
  shiftMove,
} from "./core/nesting";
import type { Level } from "./core/players";
import { createRng } from "./core/rng";
import { other, type Result, type Side } from "./core/types";
import {
  type BoardModel,
  EMPTY_BOARD,
  layerColumns,
  lineAcross,
  VISIT_MS,
} from "./scene/board-model";
import { type Gfx, readQuality } from "./scene/quality";
import type { TableView } from "./scene/table";
import { renderCredits } from "./ui/credits";
import { createDemo, drawerBoard } from "./ui/demo";
import { type PadDir, watchGamepads } from "./ui/gamepad";
import { haptics, setHapticPad, setHaptics } from "./ui/haptics";
import { chooseLanguage, localize, setL10n, setLanguage, t } from "./ui/l10n";
import { cellName, createMirror } from "./ui/mirror";
import { nativePads } from "./ui/native-pads";
import type { Playtest } from "./ui/playtest";
import {
  ACTIONS,
  type Action,
  DEFAULT_KEYS,
  FIXED_KEYS,
  keyLabel,
  loadSettings,
  normalKey,
  parseSettings,
  remappable,
  saveSettings,
} from "./ui/settings";
import { hum, play as playSound, setMusic, setVolumes, unlock as unlockSound } from "./ui/sound";
import { store } from "./ui/store";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const language = chooseLanguage(new URL(location.href), navigator.languages);
setLanguage(language);
document.documentElement.lang = language;
document.title = t("app-title");
localize(document);
const { settings, stored } = loadSettings(window);
/** No stored settings: the settings card opens first, as the welcome (GDD §6). */
// The welcome survives a reload for a graphics change (sessionStorage can be blocked too).
const WELCOME = "ttt.welcome";
const sessionGet = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const sessionSet = (k: string, v: string | null) => {
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch {
    // the welcome then shows once only
  }
};
let firstLaunch = !stored || sessionGet(WELCOME) === "1";
let quality = readQuality(new URL(location.href), window, settings.gfx, settings.reducedMotion);
document.documentElement.dataset.gfx = quality.gfx;
/** The flat board shows in the 2D setting, and until the 3D table has loaded. */
const syncBoard = () => {
  document.documentElement.dataset.board = quality.gfx === "2d" || !table ? "2d" : "3d";
  table?.setActive(quality.gfx !== "2d"); // a hidden table draws nothing
  placeBeside();
};

// Hooks for measurement (tools/lookdev-measure.mjs) and scripted playthroughs (test/e2e).
const hooks: Record<string, unknown> = { quality, ready: false };
(window as unknown as { __lookdev: typeof hooks }).__lookdev = hooks;

const setupForm = $<HTMLFormElement>("setup");
const settingsForm = $<HTMLFormElement>("settings");
// Playtest builds only (VITE_PLAYTEST=1 npm run build or npm run desktop): the session log.
// In other builds the branch is removed and the module is never bundled.
const playtest: Playtest | null =
  import.meta.env.VITE_PLAYTEST === "1"
    ? (await import("./ui/playtest")).createPlaytest($("title").querySelector("nav") as HTMLElement)
    : null;
const playCard = $("play");
const resultCard = $("result");
const statusLine = $("status");
const canvas = $<HTMLCanvasElement>("table");

type Screen =
  | "title"
  | "drawers"
  | "rules"
  | "setup"
  | "play"
  | "pause"
  | "result"
  | "settings"
  | "credits";
/** The screens over a game: the board shows and takes moves only in "play". */
const IN_GAME: readonly Screen[] = ["play", "pause", "result"];
let settingsFrom: Screen = "title";
/** The game stays on the table under these screens, and under settings opened from pause. */
const overGame = (s: Screen) =>
  IN_GAME.includes(s) || (s === "settings" && settingsFrom === "pause");

let match: Match | null = null;
let screen: Screen = "title";
/** The mode of the drawer last chosen: the setup card's and the rule card's. */
let modeId: ModeId = "classic";
let thinking = false;
let generation = 0; // cancels a pending computer move when the game changes
let cursorCell: number | null = null;
/** Misère wild, Order and Chaos: the mark the player places next (W1, OC1); each game starts with X. */
let placeMark: Side = "X";
/** Three men's morris and Nesting: the player's piece picked up to move (TM2, NE2), or null. */
let selected: number | null = null;
/** Nesting: the size of the piece the player took from the tray (NE2), or null. */
let trayPick: number | null = null;

// --- The 3D table (lazy) ---------------------------------------------------------------

let table: TableView | null = null;
let tableGfx: Gfx | null = null; // the level of the table built or being built
let tablePromise: Promise<TableView | null> | null = null;

function ensureTable(): Promise<TableView | null> {
  if (quality.gfx === "2d") return Promise.resolve(null);
  if (tablePromise) return tablePromise;
  const built = quality; // the level this table is made with, even if the setting changes
  tableGfx = built.gfx;
  tablePromise = import("./scene/table")
    .then(({ createTable }) => createTable(canvas, built))
    .then((t) => {
      table = t;
      t.onPick = pick;
      t.onHover = (cell) => setCursor(cell);
      t.setContrast(settings.contrast);
      t.setReducedMotion(settings.reducedMotion);
      t.setCameraSpeed(settings.cameraSpeed / 100);
      hooks.table = t;
      syncFrame();
      syncBoard();
      refresh();
      return t;
    })
    .catch((err) => {
      // No WebGL 2 or a failed download: the 2D board is a full replacement (GDD §9).
      console.error("3D table unavailable, using the 2D board", err);
      applyGfx("2d", false);
      return null;
    });
  return tablePromise;
}

/**
 * The table centres the board in the board area, beside the panel (TTT-4.4.2). In
 * landscape the result card stands in that area over the 3D table, and the board moves to
 * its left, so the win line stays in view; a strip under 160 px keeps the whole area.
 */
const boardArea = document.querySelector(".board-area") as HTMLElement;
function syncFrame() {
  const r = boardArea.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return table?.setFrame(null);
  const c = resultCard.hidden ? null : resultCard.getBoundingClientRect();
  const over = c && c.top < r.bottom && c.bottom > r.top && c.left > r.left && c.left < r.right;
  const gap = parseFloat(getComputedStyle(boardArea.parentElement as Element).columnGap) || 0;
  const strip = over ? c.left - gap - r.left : r.width;
  table?.setFrame({ x: r.left, y: r.top, width: strip >= 160 ? strip : r.width, height: r.height });
  placeBeside();
}
const frameObserver = new ResizeObserver(syncFrame);
frameObserver.observe(boardArea);
frameObserver.observe(resultCard);

function applyGfx(g: Gfx, save = true) {
  if (save) {
    settings.gfx = g;
    saveSettings(settings);
  }
  const url = new URL(location.href);
  if (url.searchParams.has("gfx")) {
    url.searchParams.delete("gfx");
    history.replaceState(null, "", url);
  }
  if (g !== "2d" && tableGfx && tableGfx !== g) {
    // The welcome comes back after the reload until the player continues from it.
    if (firstLaunch) sessionSet(WELCOME, "1");
    location.reload(); // high and low differ in renderer set-up; rebuild from scratch
    return;
  }
  quality = readQuality(url, window, g, settings.reducedMotion);
  hooks.quality = quality;
  document.documentElement.dataset.gfx = g;
  syncBoard();
  void ensureTable();
  refresh();
}

// --- The board: mirror, 3D table and status ----------------------------------------------

const mirror = createMirror($("mirror"));
mirror.onPick = pick;
mirror.onCursor = (cell) => setCursor(cell);

const humanCanMove = () =>
  !!match && screen === "play" && !match.result && !match.computerToMove && !thinking;

/** Off the game screens, the chosen mode's empty board waits on the table. */
function preview(): BoardModel {
  if (screen !== "setup" && screen !== "rules") return EMPTY_BOARD;
  const info = MODES[modeId] as AnyModeInfo;
  const s = info.start("X", readSetup().boards);
  const dead = info.dead(s);
  return {
    ...EMPTY_BOARD,
    cells: info.cells(s),
    dead,
    neutral: info.neutral,
    size: info.size,
    layers: !!info.layers,
    upright: info.upright,
    columns: info.layers ? layerColumns(dead.length) : info.columns,
  };
}

/** Cells along the board's side now: Overtime's grows from 3 to 5 (O2), Cube's from 4 (C3). */
const sizeNow = (m: Match) => m.info.sizeOf?.(m.state) ?? m.info.size;

function model(): BoardModel {
  if (!match || !overGame(screen)) return preview();
  const r = match.result;
  const dead = match.info.dead(match.state);
  return {
    cells: match.info.cells(match.state),
    fading: r ? [] : match.info.fading(match.state),
    // Order and Chaos: Chaos wins with no line (OC3).
    line: r?.kind === "win" && r.line.length > 0 ? r.line : null,
    // The side to move stays the last mover at the end: a line it made and lost (M2, N3).
    // Nesting: a line it uncovered belongs to the winner (NE4).
    lineLoses: r?.kind === "win" && r.winner !== match.toMove && !match.info.nest,
    outcome: r?.kind ?? null,
    dead,
    neutral: match.info.neutral,
    size: sizeNow(match),
    layers: !!match.info.layers,
    upright: match.info.upright,
    claimed: match.info.claimed?.(match.state) ?? [],
    targets: match.info.targets?.(match.state) ?? [],
    columns: match.info.layers ? layerColumns(dead.length) : match.info.columns,
    selected: screen === "play" ? selected : null,
    sizes: match.info.nest?.sizes(match.state),
    ghostSize: heldSize(),
    saucerWaits: !r && !!match.info.visitNext?.(match.state),
    visit: visitOf(match),
  };
}

/** Nesting: the size of the piece the player holds, from the tray or the board (NE2). */
function heldSize(): number | undefined {
  if (!match?.info.nest || screen !== "play") return undefined;
  if (trayPick !== null) return trayPick;
  return selected === null ? undefined : match.info.nest.sizes(match.state)[selected];
}

/** Saucer: the visit after the last move, with its ply (S3). */
function visitOf(m: Match) {
  const v = m.info.visit?.(m.state);
  return v ? { ...v, ply: m.record.moves.length } : null;
}

/**
 * The piece the side to move places: Notakto's sides both place the neutral X (N1); in
 * Misère wild and Order and Chaos the player's choice (W1, OC1).
 */
const pieceOf = (side: Side): Side =>
  match?.info.neutral ? "X" : match?.info.wild ? placeMark : side;
/** A cell's name inside a sentence, with its board or its layer (Cube) when there are several. */
const at = (cell: number) =>
  cellName(
    cell,
    match?.info.dead(match.state).length,
    match ? sizeNow(match) : undefined,
    !!match?.info.layers,
  );
/**
 * A move inside a sentence: in Misère wild and Order and Chaos its mark too (W4, OC4); a
 * slide its two cells (TM5).
 */
const atMove = (move: number) =>
  match?.info.wild
    ? t("wild-move", { mark: match.info.wild.mark(move), cell: at(match.info.wild.cell(move)) })
    : match?.info.slides && isSlide(move)
      ? t("slide-move", { from: at(slideFrom(move)), to: at(slideTo(move)) })
      : at(move);

/**
 * The player's choices now: the cells a pick can choose (`open`), and those where it puts
 * a piece down (`ghosts`). In Three men's morris a slide is two picks (TM2): first one of the
 * player's pieces that can move, then a neighbouring empty cell, or the piece again to put
 * it back; any cell otherwise.
 */
function choices(): { open: number[]; ghosts: number[] } {
  const legal = humanCanMove() && match ? match.legal() : [];
  if (match?.info.nest) return nestChoices(legal);
  if (!match?.info.slides || !legal.some(isSlide)) return { open: legal, ghosts: legal };
  if (selected === null) return { open: [...new Set(legal.map(slideFrom))], ghosts: [] };
  const ghosts = legal.filter((m) => slideFrom(m) === selected).map(slideTo);
  return { open: [selected, ...ghosts], ghosts };
}

/**
 * Nesting: a move is two picks (NE2): a piece from the tray or one of the player's top
 * pieces that can move, then a cell it fits on. The player's movable pieces stay open, so a
 * pick on one takes it instead.
 */
function nestChoices(legal: number[]): { open: number[]; ghosts: number[] } {
  const movable = legal.filter(isShift).map(shiftFrom);
  const ghosts = legal
    .filter((m) =>
      selected !== null
        ? isShift(m) && shiftFrom(m) === selected
        : trayPick !== null && !isShift(m) && placeSize(m) === trayPick,
    )
    .map(nestLanding);
  return { open: [...new Set([...ghosts, ...movable])], ghosts };
}

function refresh(placed?: number) {
  const m = model();
  const { open, ghosts } = choices();
  const turn = ghosts.length && match ? pieceOf(match.toMove) : null;
  mirror.show(m, open, turn, aimOf, placed);
  syncTray();
  $("layer-buttons").hidden = !m.layers;
  table?.show(m, placed);
  setCursor(cursorCell);
  // Undo against Casual and Keen (GDD §5).
  const undoButton = $<HTMLButtonElement>("undo");
  undoButton.hidden = !match?.undoOffered || !overGame(screen);
  undoButton.disabled = !match?.canUndo;
  const note = $("vanish-note");
  note.textContent = m.fading.length
    ? t("fading", {
        marks: m.fading
          .map((i) => t("fading-mark", { side: m.cells[i] as Side, cell: at(i) }))
          .join("; "),
      })
    : "";
  // The note keeps its space in Vanishing, so the panel's height holds during play.
  note.hidden = !match?.info.fades;
  note.style.visibility = m.fading.length ? "visible" : "hidden";
}

/** Where a pick of `cell` lands: in Gravity its column's lowest empty cell; else `cell`. */
const aimOf = (cell: number) => (match ? match.info.aim(match.state, cell) : null) ?? cell;

function setCursor(cell: number | null) {
  // An undo across a growth (O2, C3) leaves the cursor off the smaller board: it goes.
  if (cell !== null && match && cell >= match.info.cells(match.state).length) cell = null;
  cursorCell = cell;
  // Gravity: the cursor and the ghost sit where a pick in the column lands.
  const at = cell === null ? null : aimOf(cell);
  const show = at !== null && screen === "play";
  const ghost = show && match && choices().ghosts.includes(at) ? pieceOf(match.toMove) : null;
  table?.setCursor(show ? at : null, ghost, heldSize());
  // Cube: the cursor's layer is the active one on the table (GDD §3.8).
  if (at !== null && match?.info.layers) table?.setLayer(Math.floor(at / sizeNow(match) ** 2));
  mirror.aim(show && at !== cell ? at : null);
  // A soft tick when the cursor moves to a legal cell (GDD §7); a refresh is no move.
  if (cell !== tickedAt && ghost) playSound("tick");
  tickedAt = cell;
}
let tickedAt: number | null = null;

/**
 * A side's name: X and O, or Player 1 and Player 2 where the sides share marks: Notakto,
 * where both place X, and Misère wild, where both place either. In Order and Chaos, its
 * role (OC1).
 */
const sharedMarks = () => !!(match?.info.neutral || match?.info.wild);
const roleOf = (side: Side) =>
  match?.info.order ? (side === match.info.order(match.state) ? "order" : "chaos") : null;
const sideName = (side: Side) => {
  const role = roleOf(side);
  if (role) return t(`role-${role}`);
  return sharedMarks() ? t("player", { n: side === "X" ? 1 : 2 }) : side;
};
const who = (side: Side) =>
  match?.setup.opponent === "computer"
    ? t(side === HUMAN ? "you" : "the-computer")
    : sideName(side);

function turnText(): string {
  if (!match) return "";
  if (match.computerToMove)
    return match.info.visitNext?.(match.state)
      ? `${t("computer-thinking")} ${t("saucer-next")}`
      : t("computer-thinking");
  // Ultimate: where the last move sent the side to move (U2, U3).
  const targets = match.info.targets?.(match.state);
  const where = {
    where: !targets ? "none" : targets.length === 1 ? "board" : "any",
    board: (targets?.[0] ?? 0) + 1,
  };
  // Order and Chaos: against the computer, the player's role until the player's first move.
  const role = roleOf(HUMAN);
  const turn =
    match.setup.opponent === "computer"
      ? role && match.record.moves.length < 2
        ? `${t("your-move", where)} ${t("you-play", { role })}`
        : t("your-move", where)
      : t("to-move", { ...where, who: who(match.toMove) });
  return match.info.visitNext?.(match.state) ? `${turn} ${t("saucer-next")}` : turn;
}

// --- Moves -----------------------------------------------------------------------------

function pick(cell: number) {
  if (!match || screen !== "play") return;
  if (!humanCanMove()) {
    if (!match.result) {
      statusLine.textContent = t("wait-computer");
      playtest?.record({ type: "refused", reason: "wait" });
    }
    return;
  }
  if (match.info.slides) return pickMorris(cell);
  if (match.info.nest) return pickNest(cell);
  const target = match.info.aim(match.state, cell);
  if (target === null) return refuse("full", cell);
  play(match.info.wild ? match.info.wild.move(target, placeMark) : target);
}

/** Three men's morris: a placement (TM1), or the two picks of a slide (TM2). */
function pickMorris(cell: number) {
  if (!match) return;
  const legal = match.legal();
  if (!legal.some(isSlide)) {
    if (legal.includes(cell)) return play(cell);
    return refuse(
      cell === CENTRE && match.info.cells(match.state)[cell] === null ? "centre" : "taken",
      cell,
    );
  }
  const own = match.info.cells(match.state)[cell] === match.toMove;
  if (cell === selected) {
    // The piece goes back down.
    selected = null;
    playSound("tick");
    statusLine.textContent = turnText();
    return refresh();
  }
  if (own) {
    if (!legal.some((m) => slideFrom(m) === cell)) return refuse("stuck", cell);
    selected = cell;
    playSound("tick");
    statusLine.textContent = t("picked-up", { cell: at(cell) });
    return refresh();
  }
  if (selected === null) return refuse("pick", cell);
  const move = slideMove(selected, cell);
  if (!legal.includes(move)) return refuse("slide", cell);
  selected = null;
  play(move);
}

/**
 * Nesting: the second pick plays the piece held; a pick on one of the player's movable
 * pieces takes it up instead, and a pick on the piece held puts it back (NE2).
 */
function pickNest(cell: number) {
  if (!match) return;
  const legal = match.legal();
  if (cell === selected) {
    selected = null;
    return held(turnText());
  }
  const move =
    selected !== null
      ? shiftMove(selected, cell)
      : trayPick !== null
        ? placeMove(trayPick, cell)
        : null;
  if (move !== null && legal.includes(move)) {
    selected = trayPick = null;
    return play(move);
  }
  if (legal.some((m) => isShift(m) && shiftFrom(m) === cell)) {
    selected = cell;
    trayPick = null;
    const size = SIZE_NAMES[match.info.nest?.sizes(match.state)[cell] ?? 2] as string;
    return held(t("nest-picked-up", { size, cell: at(cell) }));
  }
  refuse(move === null ? "hold" : "fit", cell);
}

/** Nesting: the player takes a piece of `size` from the tray, or with null puts it back (NE2). */
function holdTray(size: number | null) {
  if (!match?.info.nest || !humanCanMove()) return;
  trayPick = size;
  selected = null;
  held(size === null ? turnText() : t("nest-from-tray", { size: SIZE_NAMES[size] as string }));
}

/** Nesting: M or Ⓧ takes the next size left in the tray, small first, then none. */
function nextTrayPiece() {
  const nest = match?.info.nest;
  if (!match || !nest || !humanCanMove()) return;
  const m = match;
  const left = [...Array(SIZES).keys()].filter((z) => nest.reserve(m.state, m.toMove, z) > 0);
  holdTray(left[trayPick === null ? 0 : left.indexOf(trayPick) + 1] ?? null);
}

const SIZE_NAMES = ["small", "medium", "large"] as const;
/** Nesting: the side whose tray shows: the side to move, or the player against the computer. */
const traySide = (m: Match): Side => (m.setup.opponent === "computer" ? HUMAN : m.toMove);

/** Nesting: a piece is held or put back; the status line says which. */
function held(status: string) {
  playSound("tick");
  statusLine.textContent = status;
  refresh();
}

/** Nesting: the tray beside the board, the pieces of each size left off the board (NE1). */
function syncTray() {
  const tray = $("tray");
  const nest = match?.info.nest;
  tray.hidden = !nest || screen !== "play";
  document.documentElement.toggleAttribute("data-nest", !!nest);
  if (!nest || !match) return;
  const side = traySide(match);
  (tray.querySelector(".tray-side") as HTMLElement).textContent = t("tray-title", { side });
  (tray.querySelector(".tray-hint") as HTMLElement).textContent = t("tray-hint", {
    key: keyLabel(settings.keys.swapMark),
  });
  tray.toggleAttribute("data-held", trayPick !== null);
  for (const b of tray.querySelectorAll<HTMLButtonElement>("button")) {
    const size = Number(b.dataset.size);
    const name = SIZE_NAMES[size] as string;
    const left = nest.reserve(match.state, side, size);
    (b.querySelector("use") as SVGUseElement).setAttribute("href", `#piece-${side.toLowerCase()}`);
    (b.querySelector(".tray-size") as HTMLElement).textContent = t("tray-size", { size: name });
    (b.querySelector(".tray-count") as HTMLElement).textContent = t("tray-left", { left });
    b.disabled = left === 0 || !humanCanMove();
    b.setAttribute("aria-pressed", String(trayPick === size));
    setL10n(b, "tray-piece", { size: name, left, side });
  }
  placeBeside();
}

/** Misère wild, Order and Chaos: the player swaps the mark to place (W1, OC1); the ghost piece shows it. */
function swapMark() {
  if (!match?.info.wild || screen !== "play") return;
  placeMark = other(placeMark);
  playSound("tick");
  syncMark();
  refresh();
}

function syncMark() {
  const b = $<HTMLButtonElement>("mark-swap");
  b.hidden = !match?.info.wild || screen !== "play";
  document.documentElement.toggleAttribute("data-wild", !!match?.info.wild);
  (b.querySelector("use") as SVGUseElement).setAttribute(
    "href",
    `#piece-${placeMark.toLowerCase()}`,
  );
  (b.querySelector("span") as HTMLElement).textContent = t("mark-now", { mark: placeMark });
  setL10n(b, "mark-swap", {
    mark: placeMark,
    action: t("action-swapMark"),
    key: keyLabel(settings.keys.swapMark),
  });
  placeBeside();
}

/**
 * The mark button (Misère wild, Order and Chaos) or the tray (Nesting) stands just right of
 * the board, centred on it, or under it when the board area has no room on the right
 * (portrait), else in the area's top right corner.
 */
function placeBeside() {
  const b = [$("mark-swap"), $("tray")].find((el) => !el.hidden);
  if (!b) return;
  const area = boardArea.getBoundingClientRect();
  let board: { left: number; right: number; top: number; bottom: number } | null = null;
  if (document.documentElement.dataset.board === "2d") {
    board = $("mirror").getBoundingClientRect();
  } else if (table) {
    // The cell centres, widened by most of a cell to the board's edge.
    const ps = table.cellPoints();
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const n = Math.sqrt(ps.length);
    const pad = ((Math.max(...xs) - Math.min(...xs)) / Math.max(1, n - 1)) * 0.8;
    board = {
      left: Math.min(...xs) - pad,
      right: Math.max(...xs) + pad,
      top: Math.min(...ys) - pad,
      bottom: Math.max(...ys) + pad,
    };
  }
  if (!board || area.width <= 0) return;
  const gap = 16;
  const w = b.offsetWidth;
  const h = b.offsetHeight;
  let x = area.right - w;
  let y = area.top;
  if (area.right - board.right >= w + gap) {
    x = board.right + gap;
    y = (board.top + board.bottom - h) / 2;
  } else if (area.bottom - board.bottom >= h + gap / 2) {
    x = (board.left + board.right - w) / 2;
    y = board.bottom + gap / 2;
  }
  b.style.left = `${Math.max(area.left, x)}px`;
  b.style.top = `${Math.max(area.top, y)}px`;
}

type Refusal =
  | "edge"
  | "dead"
  | "full"
  | "sent"
  | "closed"
  | "taken"
  | "centre"
  | "stuck"
  | "pick"
  | "slide"
  | "hold"
  | "fit";

function refuse(reason: Refusal, cell: number) {
  playSound("illegal");
  playtest?.record({ type: "refused", reason });
  statusLine.textContent = t(`refused-${reason}`);
  shake(cell);
}

function play(cell: number) {
  if (!match) return;
  const side = match.toMove;
  const count = (m: Match) => m.info.cells(m.state).filter((c) => c !== null).length;
  const before = count(match);
  const sizeBefore = sizeNow(match);
  if (!match.play(cell)) {
    if (match.info.wild) return refuse("taken", match.info.wild.cell(cell));
    return refuse(refusalOf(match, cell, sizeBefore), cell);
  }
  // Overtime and Cube: the board grew, and the mark just played moved with the others (O2, C3).
  const grew = sizeNow(match) > sizeBefore;
  const shown = match.info.placedAt?.(match.state, cell) ?? cell;
  // The cursor's cell moved with the marks.
  if (grew && cursorCell !== null)
    cursorCell = match.info.placedAt?.(match.state, cursorCell) ?? cursorCell;
  if (match.info.upright || grew) playSound("slide"); // down its column (G1)
  const cells = match.info.cells(match.state);
  // A piece the saucer carried off is no longer on its cell (S3).
  playSound((cells[shown] ?? pieceOf(side)) === "O" ? "place-o" : "place-x"); // the mark placed
  haptics.place();
  // The oldest mark went (V2); a slide or a cover keeps the count of pieces in sight.
  if (count(match) === before && !match.info.slides && !match.info.nest) playSound("vanish");
  // A low hum on the turn of a side whose oldest mark goes with its next move (V6), or
  // whose next piece the saucer takes (S3).
  if (
    !match.result &&
    (match.info.fading(match.state).some((i) => cells[i] === match?.toMove) ||
      match.info.visitNext?.(match.state))
  )
    hum();
  // Saucer: the push or the carry sounds as the saucer sets the piece down or takes it.
  const visit = visitOf(match);
  if (visit && visit.to !== visit.from)
    window.setTimeout(
      () => playSound(visit.to === null ? "vanish" : "slide"),
      quality.reducedMotion ? 0 : VISIT_SOUND_MS,
    );
  refresh(shown);
  void autosave();
  const moved = match.info.nest
    ? nestMoved(side, cell)
    : match.info.slides && isSlide(cell)
      ? t("moved", { who: who(side), from: at(slideFrom(cell)), to: at(slideTo(cell)) })
      : t("played", { who: who(side), cell: match.info.wild ? atMove(cell) : at(shown) });
  const note = grew ? t(`${match.setup.mode}-grew`) : visit ? visitText(visit) : "";
  if (match.result) return finish([moved, note].filter(Boolean).join(" "));
  statusLine.textContent = [moved, note, turnText()].filter(Boolean).join(" ");
  if (match.computerToMove) computerTurn(note);
}

/** Nesting: a move just played, with its piece's size (NE2). */
function nestMoved(side: Side, move: number): string {
  const to = nestLanding(move);
  const size = SIZE_NAMES[match?.info.nest?.sizes(match.state)[to] ?? 0] as string;
  return isShift(move)
    ? t("nest-moved", { who: who(side), size, from: at(shiftFrom(move)), to: at(to) })
    : t("nest-placed", { who: who(side), size, cell: at(to) });
}

/** Why the rules refused a placement on `cell`, on a board `size` cells across. */
function refusalOf(game: Match, cell: number, size: number): Refusal {
  const first = !game.record.moves.length;
  // Vanishing: no edge on the first move (V3); Saucer: no centre (S2).
  const opening = first ? game.info.openingRefusal?.(cell) : null;
  if (opening) return opening;
  // Ultimate: on a decided board (U4), or off the board the last move sent to (U2).
  const board = Math.floor(cell / size ** 2);
  const targets = game.info.targets?.(game.state);
  if (game.info.dead(game.state)[board]) return targets ? "closed" : "dead";
  if (targets && !targets.includes(board)) return "sent";
  return "taken";
}

/** Saucer: when the saucer sets a pushed piece down, or takes one off (scene/saucer.ts). */
const VISIT_SOUND_MS = 1100;

/** Saucer: what the visit did (S3). */
function visitText(v: { side: Side; from: number; to: number | null }) {
  if (v.to === null) return t("saucer-carried", { side: v.side });
  if (v.to === v.from) return t("saucer-stayed", { side: v.side, cell: at(v.from) });
  return t("saucer-pushed", { side: v.side, from: at(v.from), to: at(v.to) });
}

/** `note` stays in the status line while the computer thinks: a growth (O2, C3), a visit (S3). */
function computerTurn(note = "") {
  if (!match) return;
  thinking = true;
  statusLine.textContent = [note, turnText()].filter(Boolean).join(" ");
  refresh();
  const gen = ++generation;
  // A 300–700 ms thinking delay (GDD §4.1), fixed per ply so it never uses the game's rng.
  // It waits for a saucer's visit to finish as well (S3).
  const visiting = match.info.visit?.(match.state) && !quality.reducedMotion ? VISIT_MS : 0;
  const delay = 300 + ((match.record.moves.length * 137) % 400) + visiting;
  const wait = new Promise((r) => window.setTimeout(r, delay));
  const m = match;
  preparing = preparing.catch(() => m.prepare()); // a failed table load is tried again
  // A line game's search runs in its worker during the delay.
  // An undo or pause during the load cancels the turn before the computer starts on it.
  const move = preparing.then(() =>
    gen === generation ? m.computerMove() : Promise.reject(new Error("cancelled")),
  );
  Promise.all([move, wait]).then(
    ([cell]) => {
      if (gen !== generation || match !== m || screen !== "play") return;
      thinking = false;
      play(cell);
    },
    () => {
      if (gen !== generation) return;
      statusLine.textContent = t(m.info.search ? "computer-search-failed" : "computer-load-failed");
    },
  );
}

/** Takes back the player's move and the computer's reply (GDD §5); the generator rewinds. */
function undo() {
  if (!match || screen !== "play" || !match.undo()) return;
  selected = trayPick = null;
  generation++; // the computer's pending reply is dropped
  thinking = false;
  refresh();
  void autosave();
  statusLine.textContent = `${t("undone")} ${turnText()}`;
}

function shake(cell: number) {
  const el = $("mirror").querySelectorAll<HTMLElement>(".cell")[cell];
  el?.classList.remove("shake");
  void el?.offsetWidth; // restart the animation
  el?.classList.add("shake");
}

// --- Result (R9) -----------------------------------------------------------------------

function finish(moved: string) {
  if (!match) return;
  const r = match.result as Result;
  const vsComputer = match.setup.opponent === "computer";
  const title = resultTitle(r, vsComputer);
  const moves = match.opening + match.record.moves.length;
  statusLine.textContent = t("result-status", { moved, title });
  playSound(r.kind === "win" ? "win" : "draw");
  if (r.kind === "win") haptics.win();
  // Solved modes only (§4.2): the line games have no table to judge a move by.
  const hint =
    vsComputer && match.solved && !(r.kind === "win" && r.winner === HUMAN)
      ? resultHint(match)
      : null;
  if (vsComputer) {
    const outcome = r.kind === "draw" ? "draw" : r.winner === HUMAN ? "win" : "loss";
    progress = addResult(progress, match.setup.mode, match.setup.level, outcome);
    void store.put("progress", progress);
    syncProgress();
  }
  playtest?.record({ type: "end", result: logResult(r, vsComputer), moves, hint: !!hint?.mistake });
  $("result-title").textContent = title;
  $("result-detail").textContent = `${resultDetail(match, r, model())} ${t("moves", { moves })}`;
  $("result-hint").textContent = hint?.text ?? "";
  $("result-hint").hidden = !hint;
  // Let the win line sweep before the card covers part of the table.
  const gen = generation;
  window.setTimeout(
    () => {
      if (gen === generation && screen === "play") show("result");
    },
    quality.reducedMotion ? 0 : 700,
  );
}

function resultTitle(r: Result, vsComputer: boolean): string {
  if (r.kind === "draw") return t("result-draw");
  if (vsComputer) return t(r.winner === HUMAN ? "result-you-win" : "result-computer-wins");
  return t("result-wins", { who: sideName(r.winner) });
}

/** How the game ended: the draw's reason, or the line and who made it. */
function resultDetail(game: Match, r: Result, m: BoardModel): string {
  if (r.kind === "draw") return t(`draw-${r.reason}`);
  if (r.line.length === 0) return t("no-five-left"); // Order and Chaos: OC3
  const [first, end] = [r.line[0] as number, r.line.at(-1) as number];
  // Nesting: the mover lifted a piece off the other side's line (NE4).
  if (game.info.nest && r.winner !== game.toMove)
    return t("nest-uncovered", { who: who(game.toMove), from: at(first), to: at(end) });
  // Ultimate: the line is three claimed boards, named by their centre cells (U5).
  const board = (c: number) => Math.floor(c / m.size ** 2) + 1;
  if (lineAcross(m)) return t("boards-made", { from: board(first), to: board(end) });
  // Misère (M2) and Notakto (N3): the line belongs to the side that made it and lost.
  const id = `line-made${m.lineLoses ? "-by" : ""}${m.dead.length > 1 && !m.layers ? "-last" : ""}`;
  return t(id, { who: who(game.toMove), count: r.line.length, from: at(first), to: at(end) });
}

/** The player's first mistake, or that there was none (§4.2). */
function resultHint(game: Match): { text: string; mistake: boolean } {
  const h = game.hint();
  if (h)
    return {
      text: t(h.missedWin ? "hint-missed-win" : "hint-better", {
        ply: h.hint.ply,
        played: atMove(h.hint.played),
        better: atMove(h.hint.better),
      }),
      mistake: true,
    };
  const solved = game.solvedStart();
  const lost = solved && solved !== "draw" && solved !== HUMAN;
  return { text: t(lost ? "hint-no-mistake-loss" : "hint-no-mistake-draw"), mistake: false };
}

/** The result in the playtest log, which stays in English. */
function logResult(r: Result, vsComputer: boolean): string {
  if (r.kind === "draw") return `draw (${r.reason})`;
  if (vsComputer) return r.winner === HUMAN ? "you win" : "the computer wins";
  const shared = sharedMarks() ? `player ${r.winner === "X" ? 1 : 2}` : r.winner.toLowerCase();
  return `${roleOf(r.winner) ?? shared} wins`;
}

// --- Screens (GDD §6) ----------------------------------------------------------------

const CARDS: Partial<Record<Screen, HTMLElement>> = {
  title: $("title"),
  drawers: $("drawers"),
  rules: $("rules"),
  setup: setupForm,
  pause: $("pause"),
  settings: settingsForm,
  credits: $("credits"),
};

/** The first control of a screen, where focus goes when it opens. */
function firstFocus(next: Screen): HTMLElement | null {
  if (next === "title") return $("continue").hidden ? $("open-play") : $("continue");
  if (next === "drawers") return $("drawer-list").querySelector(`[data-mode="${modeId}"]`);
  if (next === "setup") return setupForm.querySelector("fieldset:not([hidden]) input:checked");
  if (next === "pause") return $("resume");
  if (next === "result") return $("result-title");
  return CARDS[next]?.querySelector("h2") ?? null;
}

/**
 * Shows a screen and moves focus to `focus`, or to its first control. Cards rise and the
 * cabinet's doors swing in CSS; View Transitions are not used, because in Chromium a click
 * during the transition was lost (TTT-4.1.6 research).
 */
function show(next: Screen, focus?: HTMLElement | null) {
  const from = screen;
  screen = next;
  remapping = null;
  syncKeys();
  for (const [id, el] of Object.entries(CARDS)) el.hidden = id !== next;
  const inGame = overGame(next);
  playCard.hidden = !inGame;
  resultCard.hidden = next !== "result";
  boardArea.hidden = !inGame;
  document.documentElement.dataset.screen = next;
  document.documentElement.toggleAttribute("data-ingame", inGame);
  syncMark();
  if (next === "title") syncContinue();
  if (next === "setup") prefetch();
  refresh();
  if (next === "play") mirror.focus();
  else (focus ?? firstFocus(next))?.focus();
  screenSound(from, next);
  syncMusic();
}

/** The cabinet's doors and drawers, and the cards (style guide, "Sound"). */
function screenSound(from: Screen, next: Screen) {
  if (from === next || next === "play") return;
  if (next === "drawers" && from === "title") playSound("drawer-open");
  else if (next === "title" && from === "drawers") playSound("drawer-close");
  else if (next === "rules")
    playSound("card-flip"); // the card turns over to its rules
  else if (next !== "drawers" && next !== "title") playSound("card-place");
}

/** The cabinet's loop off the table; at the table the other one, if music stays on. */
function syncMusic() {
  const atTable = overGame(screen);
  setMusic(!atTable ? "music-cabinet" : settings.musicInPlay ? "music-table" : null);
}

let preparing: Promise<void> = Promise.resolve();

/** Starts a game, or with `resumed` continues one (the autosave, or a paused game). */
function start(m: Match, resumed = false) {
  generation++;
  thinking = false;
  match = m;
  hooks.match = m;
  placeMark = "X";
  selected = trayPick = null;
  syncMark();
  modeId = m.setup.mode;
  $("mode-title").textContent = modeName(m.setup.mode);
  $("play-rule").textContent = modeRule(m.setup.mode);
  // The player can move at once; only the computer's turn waits for its solved table.
  if (!resumed)
    playtest?.record({
      type: "start",
      mode: m.setup.mode,
      opponent: m.setup.opponent,
      level: m.setup.level,
      youFirst: m.record.first === HUMAN,
      ...(m.info.neutral ? { boards: m.setup.boards } : {}),
      ...(m.info.fairStart ? { fair: m.setup.fair } : {}),
    });
  preparing = m.prepare();
  preparing.catch((err) => console.error(err));
  statusLine.textContent = turnText();
  void autosave();
  show("play");
  if (m.computerToMove) computerTurn();
}

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0] as number;

function readSetup(): Setup {
  const f = new FormData(setupForm);
  return {
    mode: modeId,
    opponent: f.get("opponent") === "friend" ? "friend" : "computer",
    level: f.get("level") as Level,
    side: f.get("side") as Setup["side"],
    boards: Number(f.get("boards") ?? 1),
    fair: f.get("fair") === "on",
  };
}

const modeName = (id: ModeId) => t(`mode-${id}`);
const modeRule = (id: ModeId) => t(`mode-${id}-rule`);
/** Who wins with perfect play; Notakto's depends on the board count. */
const modeFairness = (id: ModeId, boards: number) => t(`mode-${id}-fairness`, { boards });
const levelName = (level: Level) => t(`level-${level}`);

function syncSetup() {
  // A form leaves out a disabled fieldset: the computer's fieldsets follow the opponent
  // before the setup is read, so a switch from a friend reads the level and side.
  const friend = (setupForm.elements.namedItem("opponent") as RadioNodeList).value === "friend";
  for (const fs of setupForm.querySelectorAll<HTMLFieldSetElement>("[data-computer]"))
    fs.disabled = friend;
  const s = readSetup();
  $("setup-title").textContent = modeName(s.mode);
  $("rule-card").querySelector(".rule")?.replaceChildren(modeRule(s.mode));
  // Notakto: who wins with perfect play, and so whether the player's side can win (§3.7).
  // Order and Chaos: the role the side plays (OC1).
  const info = MODES[s.mode] as AnyModeInfo;
  const yours =
    info.boards && s.opponent === "computer" && s.side !== "alternate"
      ? ` ${t(info.boards.firstWins(s.boards) === (s.side === "first") ? "you-can-win" : "computer-can-win")}`
      : info.order && s.opponent === "computer"
        ? ` ${t("your-role", { side: s.side })}`
        : "";
  $("rule-card")
    .querySelector(".fairness")
    ?.replaceChildren(modeFairness(s.mode, s.boards) + yours);
  $("boards").hidden = !info.boards;
  $("fair").hidden = !info.fairStart;
  // Progress (§4.3): the player's record against the chosen level.
  $("record").hidden = s.opponent !== "computer";
  $("record").textContent =
    s.opponent === "computer"
      ? t("record", { level: levelName(s.level), ...countsOf(progress, s.mode, s.level) })
      : "";
  if (screen === "setup") refresh(); // the table shows the chosen board count
}

/** Fetches the chosen mode's solved table while the player sets up a computer game. */
function prefetch() {
  const s = readSetup();
  if (s.opponent === "computer") void MODES[s.mode].loadSolution?.().catch(() => {});
}

// --- The cabinet: drawers, rule cards, credits -------------------------------------------

/** A mode's fairness in general: Notakto's depends on the board count (setup card). */
const generalFairness = (info: AnyModeInfo) =>
  info.neutral ? t("mode-notakto-solved") : modeFairness(info.id, 1);

/** One drawer per mode: its board in miniature, the rule line, the fairness note, a badge. */
for (const info of Object.values(MODES) as AnyModeInfo[]) {
  if (info.hidden) continue; // Cube waits for its real 3D look (P28)
  const li = $("drawer-list").appendChild(document.createElement("li"));
  li.className = "drawer";
  const pull = li.appendChild(document.createElement("button"));
  pull.type = "button";
  pull.className = "drawer-pull";
  pull.dataset.mode = info.id;
  const name = modeName(info.id);
  pull.setAttribute("aria-label", name);
  const label = pull.appendChild(document.createElement("span"));
  label.className = "drawer-label";
  label.textContent = name;
  pull.appendChild(drawerBoard(info.id));
  const text = pull.appendChild(document.createElement("span"));
  text.className = "drawer-text";
  const line = (id: string, cls: string, content: string) => {
    const el = text.appendChild(document.createElement("span"));
    el.id = id;
    el.className = cls;
    el.textContent = content;
  };
  line(`rule-${info.id}`, "rule", modeRule(info.id));
  line(`fair-${info.id}`, "fairness", generalFairness(info));
  line(`badge-${info.id}`, "badge", "");
  pull.addEventListener("click", () => chooseMode(info.id));
  const help = li.appendChild(document.createElement("button"));
  help.type = "button";
  help.className = "howto";
  help.textContent = "?";
  setL10n(help, "how-to-play-mode", { mode: name });
  help.addEventListener("click", () => openRules(info.id, "drawers"));
}

let progress = NO_PROGRESS;
/** The drawers' badges and the setup card's record follow the progress. */
function syncProgress() {
  for (const id of Object.keys(MODES) as ModeId[]) {
    if ((MODES[id] as AnyModeInfo).hidden) continue; // no drawer, no badge (P28)
    const b = badge(progress, id);
    const el = $(`badge-${id}`);
    el.textContent = b ? t(b === "beat" ? "badge-beat" : "badge-drew") : "";
    el.hidden = !b;
  }
  syncSetup();
}

function chooseMode(id: ModeId) {
  modeId = id;
  playtest?.record({ type: "mode", mode: id });
  syncSetup();
  show("setup");
}

let demo: { stop(): void } | null = null;
let rulesFrom: Screen = "drawers";
function openRules(id: ModeId, from: Screen) {
  modeId = id;
  rulesFrom = from;
  $("rules-title").textContent = modeName(id);
  $("rules").querySelector(".rule")?.replaceChildren(modeRule(id));
  $("rules").querySelector(".fairness")?.replaceChildren(generalFairness(MODES[id]));
  demo?.stop();
  demo = createDemo($("demo"), id, quality.reducedMotion);
  show("rules");
}

function closeRules(to: Screen) {
  demo?.stop();
  demo = null;
  if (to === "setup") syncSetup();
  show(
    to,
    to === "drawers" ? $("drawer-list").querySelector(`[data-mode="${modeId}"] ~ .howto`) : null,
  );
}

function openSettings(from: Screen) {
  settingsFrom = from;
  show("settings");
}

let creditsDrawn = false;
function openCredits() {
  if (!creditsDrawn) renderCredits($("credits-body"));
  creditsDrawn = true;
  show("credits");
}

/** Leaves the table for a card; a pending computer move is replayed on resume. */
function pause() {
  if (match?.result) return show("result"); // also during the win line's sweep
  if (screen === "play") playtest?.record({ type: "menu" });
  generation++;
  thinking = false;
  show("pause");
}

function resume() {
  show("play");
  if (match?.computerToMove) computerTurn();
}

/** Esc, B or a Back button: one step back (GDD §6). */
function back() {
  const opener = (id: string) => $(id);
  if (screen === "drawers") show("title", opener("open-play"));
  else if (screen === "rules") closeRules(rulesFrom);
  else if (screen === "setup") show("drawers");
  else if (screen === "play" && match?.info.nest && (selected !== null || trayPick !== null))
    selected !== null ? pickNest(selected) : holdTray(null); // put the piece back
  else if (screen === "play" && selected !== null)
    pickMorris(selected); // put the piece back
  else if (screen === "play") pause();
  else if (screen === "pause") resume();
  else if (screen === "result") show("drawers");
  else if (screen === "settings" && firstLaunch) {
    firstLaunch = false; // the welcome is shown once, and its choices are kept
    sessionSet(WELCOME, null);
    saveSettings(settings);
    syncFirstLaunch();
    show("title");
  } else if (screen === "settings")
    show(settingsFrom, opener(settingsFrom === "pause" ? "pause-settings" : "open-settings"));
  else if (screen === "credits") show("title", opener("open-credits"));
}

// --- The autosave (GDD §8) -------------------------------------------------------------

/** Measurement scenes (?scene=) are not the player's game and are never saved. */
let saving = true;
/** Keeps the game after every move; a finished game leaves nothing to continue. */
function autosave(): Promise<unknown> {
  if (!match || !saving) return Promise.resolve();
  return match.result ? store.delete("game") : store.put("game", toSave(match));
}

/** "Continue: Vanishing vs Keen, your move" on the title, when a game is unfinished. */
function syncContinue() {
  const m = match && !match.result ? match : null;
  const button = $("continue");
  button.hidden = !m;
  $("open-play").classList.toggle("quiet", !!m); // one main button on the title
  if (!m) return;
  const mode = modeName(m.setup.mode);
  button.textContent =
    m.setup.opponent === "computer"
      ? t("continue-computer", {
          mode,
          level: levelName(m.setup.level),
          computerMoves: m.computerToMove ? "yes" : "no",
        })
      : t("continue-friend", { mode, who: sideName(m.toMove) });
}

/**
 * Reads the autosave. A save that cannot be read is reported and kept under another key,
 * never overwritten; the next game saves afresh.
 */
async function loadSaved() {
  const [saved, stored] = await Promise.all([store.get("game"), store.get("progress")]);
  progress = readProgress(stored);
  syncProgress();
  if (saved !== undefined && !match) {
    const read = readSave(saved);
    if ("match" in read) match = read.match;
    else {
      console.error("saved game unreadable:", read.error);
      await store.put(`unreadable-${Date.now()}`, saved);
      await store.delete("game");
      const note = $("save-note");
      note.textContent = t("save-unreadable");
      note.hidden = false;
    }
  }
  if (screen === "title") {
    // Continue comes first on the title once there is a game to continue.
    const focused = document.activeElement === $("open-play");
    syncContinue();
    if (focused && !$("continue").hidden) $("continue").focus();
  }
  hooks.saveRead = true;
}

// --- Controls --------------------------------------------------------------------------

setupForm.addEventListener("change", () => {
  syncSetup();
  prefetch();
});
setupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  start(new Match(readSetup(), seed()));
});
$("setup-rules").addEventListener("click", () => openRules(modeId, "setup"));
$("rules-setup").addEventListener("click", () => {
  if (rulesFrom === "drawers") playtest?.record({ type: "mode", mode: modeId });
  closeRules("setup");
});

// --- Settings (GDD §8) -------------------------------------------------------------------

const field = (name: string) => settingsForm.elements.namedItem(name) as HTMLInputElement;
const percent = (id: string, n: number) => {
  $(id).textContent = t("percent", { n });
};

/** The settings card's sliders and the outputs that show their values. */
const SLIDERS = [
  ["textSize", "text-size-value"],
  ["cameraSpeed", "camera-speed-value"],
  ["masterVolume", "master-volume-value"],
  ["musicVolume", "music-volume-value"],
  ["effectsVolume", "effects-volume-value"],
] as const;

/** Applies every setting but the graphics level (applyGfx), and shows them on the card. */
function applySettings() {
  const root = document.documentElement;
  root.style.fontSize = `${settings.textSize}%`; // sizes are in rem
  root.dataset.contrast = settings.contrast ? "more" : "normal";
  root.dataset.motion = settings.reducedMotion ? "reduced" : "full";
  quality.reducedMotion = settings.reducedMotion;
  setVolumes({
    master: settings.masterVolume,
    music: settings.musicVolume,
    effects: settings.effectsVolume,
  });
  syncMusic();
  setHaptics(settings.haptics);
  table?.setContrast(settings.contrast);
  table?.setReducedMotion(settings.reducedMotion);
  table?.setCameraSpeed(settings.cameraSpeed / 100);
  (settingsForm.elements.namedItem("gfx") as RadioNodeList).value = quality.gfx;
  for (const name of ["musicInPlay", "contrast", "reducedMotion", "haptics"] as const)
    field(name).checked = settings[name];
  for (const [name, out] of SLIDERS) {
    field(name).value = String(settings[name]);
    percent(out, settings[name]);
  }
  syncKeys();
}

const onSettings = (e: Event) => {
  const el = e.target as HTMLInputElement;
  // Sliders apply as they move ("input"); the rest once, on "change".
  if ((e.type === "input") !== (el.type === "range")) return;
  if (el.name === "gfx") {
    if (el.checked && el.value !== quality.gfx) applyGfx(el.value as Gfx);
    return;
  }
  if (!el.name) return;
  settings.musicInPlay = field("musicInPlay").checked;
  settings.contrast = field("contrast").checked;
  settings.reducedMotion = field("reducedMotion").checked;
  settings.haptics = field("haptics").checked;
  for (const [name] of SLIDERS) settings[name] = Number(field(name).value);
  saveSettings(settings);
  applySettings();
};
settingsForm.addEventListener("input", onSettings);
settingsForm.addEventListener("change", onSettings);
settingsForm.addEventListener("submit", (e) => e.preventDefault());

function syncFirstLaunch() {
  settingsForm.toggleAttribute("data-first", firstLaunch);
  $("settings-title").textContent = t(firstLaunch ? "welcome" : "settings");
  $("settings-done").textContent = t(firstLaunch ? "welcome-done" : "back");
}

const note = (text: string) => {
  $("settings-note").textContent = text;
};

// Remapping (GDD §5): the action keys; the board's keys and Esc keep their jobs.
const actionName = (a: Action) => t(`action-${a}`);
/** The note when an action keeps its key. */
const kept = (a: Action) =>
  t("remap-kept", { action: actionName(a), key: keyLabel(settings.keys[a]) });
let remapping: Action | null = null;
const keyButtons = new Map<Action, HTMLButtonElement>();
for (const a of ACTIONS) {
  const li = $("key-list").appendChild(document.createElement("li"));
  li.appendChild(document.createElement("span")).textContent = actionName(a);
  const b = li.appendChild(document.createElement("button"));
  b.type = "button";
  b.className = "stamp small quiet";
  b.addEventListener("click", () => {
    remapping = a;
    syncKeys();
    note(t("remap-prompt", { action: actionName(a), key: keyLabel(settings.keys[a]) }));
  });
  keyButtons.set(a, b);
}

/** The key list, and the camera buttons' labels, which name their keys. */
function syncKeys() {
  for (const [a, b] of keyButtons) {
    const key = keyLabel(settings.keys[a]);
    b.textContent = remapping === a ? t("key-press") : key;
    setL10n(b, "key-button", { action: actionName(a), key });
  }
  for (const b of document.querySelectorAll<HTMLElement>("[data-camera]")) {
    const a = b.dataset.camera as Action;
    setL10n(b, "camera-button", { action: actionName(a), key: keyLabel(settings.keys[a]) });
  }
  syncMark();
}

// The next key pressed while remapping is the new key; it never reaches the game.
window.addEventListener(
  "keydown",
  (e) => {
    if (!remapping) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
    const a = remapping;
    remapping = null;
    const key = normalKey(e.key);
    if (e.key === "Escape") note(kept(a));
    else if (FIXED_KEYS.includes(key)) note(t("remap-fixed"));
    else if (!remappable(key)) note(t("remap-invalid"));
    else {
      const other = ACTIONS.find((o) => o !== a && settings.keys[o] === key);
      if (other) settings.keys[other] = settings.keys[a]; // the two actions swap keys
      settings.keys[a] = key;
      saveSettings(settings);
      const swapped = other
        ? ` ${t("remap-swapped", { action: actionName(other), key: keyLabel(settings.keys[other]) })}`
        : "";
      note(t("remap-done", { action: actionName(a), key: keyLabel(key) }) + swapped);
    }
    syncKeys();
    keyButtons.get(a)?.focus();
  },
  true,
);
$("keys-reset").addEventListener("click", () => {
  settings.keys = { ...DEFAULT_KEYS };
  saveSettings(settings);
  syncKeys();
  note(t("keys-reset-done"));
});

// Export and import, on the web (GDD §8).
$("settings-export").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" }),
  );
  a.download = "noughty-crosses-settings.json";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  note(t("settings-exported"));
});
$("settings-import").addEventListener("click", () => $("settings-file").click());
$("settings-file").addEventListener("change", async () => {
  const input = $<HTMLInputElement>("settings-file");
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  let raw: unknown = null;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    // not JSON: reported below
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return note(t("settings-not-a-file"));
  Object.assign(settings, parseSettings(raw, settings));
  saveSettings(settings);
  note(t("settings-imported"));
  if (settings.gfx && settings.gfx !== quality.gfx) applyGfx(settings.gfx);
  applySettings(); // after the graphics level, so the card shows the one in use
});

// --- Input: keys, camera, controller (GDD §5) ---------------------------------------------

/** Glyphs and rumble follow the device used last. */
function setInput(kind: "keys" | "pointer" | "pad", pad: number | null = null) {
  document.documentElement.dataset.input = kind;
  setHapticPad(pad);
}
document.addEventListener("pointerdown", () => setInput("pointer"), true);

// Sound starts with the first interaction that browsers count (a key, a click or a touch):
// then the effects load and the music begins.
const UNLOCKS = ["pointerdown", "pointerup", "keydown"] as const;
const onFirstInput = () => {
  // Browsers without the User Activation API (Safari before 16.4) take the event itself.
  if (navigator.userActivation?.hasBeenActive === false) return;
  for (const type of UNLOCKS) document.removeEventListener(type, onFirstInput, true);
  unlockSound();
};
for (const type of UNLOCKS) document.addEventListener(type, onFirstInput, true);

// A button that keeps the screen gets the stamp; one that changes it, the screen's sound.
let clickedOn: Screen = "title";
document.addEventListener("click", () => (clickedOn = screen), true);
document.addEventListener("click", (e) => {
  if ((e.target as Element).closest?.("button") && screen === clickedOn) playSound("press");
});

const cameraOn = () =>
  !!table && quality.gfx !== "2d" && (screen === "play" || screen === "result");
const TURNS: Partial<Record<Action, [number, number]>> = {
  rotateLeft: [-1, 0],
  rotateRight: [1, 0],
  tiltUp: [0, -1],
  tiltDown: [0, 1],
};
function act(a: Action) {
  if (a === "undo") return undo();
  if (a === "swapMark") return match?.info.nest ? nextTrayPiece() : swapMark();
  if (!cameraOn()) return;
  if (a === "resetCamera") return table?.resetCamera();
  const [x, y] = TURNS[a] as [number, number];
  table?.turnCamera(x, y);
}
for (const b of document.querySelectorAll<HTMLElement>("[data-camera]"))
  b.addEventListener("click", () => act(b.dataset.camera as Action));
// Cube: the layer buttons move the board's cursor a layer, as Page Up and Page Down do.
for (const b of document.querySelectorAll<HTMLElement>("[data-layer]"))
  b.addEventListener("click", () =>
    $("mirror").dispatchEvent(
      new KeyboardEvent("keydown", { key: b.dataset.layer, bubbles: true, cancelable: true }),
    ),
  );
$("undo").addEventListener("click", () => undo());
$("mark-swap").addEventListener("click", () => swapMark());
for (const b of $("tray").querySelectorAll<HTMLButtonElement>("button"))
  b.addEventListener("click", () => {
    const size = Number(b.dataset.size);
    holdTray(size === trayPick ? null : size);
  });

document.addEventListener("keydown", (e) => {
  if (e.isTrusted) setInput("keys"); // a controller's moves on the board are untrusted
  if (e.key === "Escape") {
    e.preventDefault();
    back();
    return;
  }
  // A key the board used is not an action: in Cube, PageUp and PageDown change the layer.
  if (e.altKey || e.metaKey || e.defaultPrevented || !overGame(screen)) return;
  const key = normalKey(e.key);
  if (e.ctrlKey) {
    if (key === "z") {
      e.preventDefault();
      undo();
    }
    return;
  }
  const a = ACTIONS.find((x) => settings.keys[x] === key);
  if (!a) return;
  e.preventDefault();
  act(a);
});

/** The current screen's controls in order: radio groups by their checked button. */
function controls(): HTMLElement[] {
  const root = screen === "result" ? resultCard : CARDS[screen];
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>("button, input, a[href]")].filter(
    (el) =>
      !el.matches(":disabled") &&
      el.getClientRects().length > 0 &&
      !(el instanceof HTMLInputElement && el.type === "radio" && !el.checked),
  );
}

function padMove(d: PadDir | "layerUp" | "layerDown") {
  const el = document.activeElement as HTMLElement | null;
  if (screen === "play") {
    // On the table the d-pad moves the board's cursor, as the arrow keys do; in Cube the
    // shoulder buttons change its layer, as PageUp and PageDown do.
    if (!el || !$("mirror").contains(el)) return mirror.focus();
    const key = {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      layerUp: "PageUp",
      layerDown: "PageDown",
    }[d];
    // Cancelable, so a key the board used is not also an action (a layer key would tilt).
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    return;
  }
  if (d === "layerUp" || d === "layerDown") return;
  if (el instanceof HTMLInputElement && (d === "left" || d === "right")) {
    const by = d === "left" ? -1 : 1;
    if (el.type === "range") {
      by < 0 ? el.stepDown() : el.stepUp();
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (el.type === "radio" && el.form) {
      const group = [...(el.form.elements.namedItem(el.name) as RadioNodeList)].filter(
        (r) => !(r as HTMLInputElement).matches(":disabled"),
      ) as HTMLInputElement[];
      const next = group[group.indexOf(el) + by];
      next?.click();
      next?.focus();
      return;
    }
  }
  const list = controls();
  const at = el ? list.indexOf(el) : -1;
  const step = d === "up" || d === "left" ? -1 : 1;
  const next = at < 0 ? list[0] : list[Math.min(list.length - 1, Math.max(0, at + step))];
  next?.focus();
}

nativePads(window);
watchGamepads(window, {
  used: (i) => setInput("pad", i),
  move: padMove,
  button(b) {
    if (remapping) {
      // A controller cannot press a key: A or B leaves the old key in place.
      const a = remapping;
      remapping = null;
      syncKeys();
      note(kept(a));
      return;
    }
    if (b === "back") back();
    else if (b === "undo") undo();
    else if (b === "swapMark") act("swapMark");
    else if (b === "reset") act("resetCamera");
    else if (b === "layerUp" || b === "layerDown") padMove(b);
    else {
      const el = document.activeElement as HTMLElement | null;
      // A heading or the page has focus: A moves to the first control instead.
      if (el && (el.matches("button, input, a[href]") || $("mirror").contains(el))) el.click();
      else padMove("down");
    }
  },
  camera(x, y, dt) {
    // Six camera steps a second at full tilt, scaled by the sensitivity in the table.
    if (cameraOn()) table?.turnCamera(x * 6 * dt, y * 6 * dt, false);
  },
});

$("continue").addEventListener("click", () => match && !match.result && start(match, true));
$("open-play").addEventListener("click", () => show("drawers"));
$("open-settings").addEventListener("click", () => openSettings("title"));
$("open-credits").addEventListener("click", () => openCredits());
$("pause-open").addEventListener("click", () => pause());
$("resume").addEventListener("click", () => resume());
$("pause-settings").addEventListener("click", () => openSettings("pause"));
$("pause-change").addEventListener("click", () => show("drawers"));
$("rematch").addEventListener("click", () => match && start(match.rematch(seed())));
$("change").addEventListener("click", () => show("drawers"));
for (const b of document.querySelectorAll<HTMLElement>("[data-back]"))
  b.addEventListener("click", () => back());
// Quit, in the desktop app only (GDD §6); settings export and import on the web only (§8).
const tauri = (window as { __TAURI__?: { core: { invoke(c: string, a?: object): unknown } } })
  .__TAURI__;
$("quit").hidden = !tauri;
$("transfer").hidden = !!tauri;
// The last move's save is queued before this one, so the game is kept before the app ends.
$("quit").addEventListener("click", () => {
  void autosave().finally(() => tauri?.core.invoke("quit"));
});
// Android's Back button is Esc; on the title it sends the app to the background, as Back
// does in Android's own apps (TTT-4.4.2).
if ((window as { Capacitor?: { isNativePlatform(): boolean } }).Capacitor?.isNativePlatform())
  import("@capacitor/app")
    .then(({ App }) =>
      App.addListener("backButton", () => (screen === "title" ? App.minimizeApp() : back())),
    )
    .catch((err) => console.error("Back button unavailable", err));

// --- Start-up --------------------------------------------------------------------------

applySettings();
syncBoard();
syncSetup();
syncFirstLaunch();
show(firstLaunch ? "settings" : "title");
// Play stays disabled in the HTML until here, so an early click cannot submit the form
// natively and reload the page.
setupForm.querySelector<HTMLButtonElement>("button[type=submit]")?.removeAttribute("disabled");
hooks.titleReadyMs = performance.now(); // since navigation start
void loadSaved();

// Fixed scenes for measurement: ?scene=vanishing-mid | classic-won | notakto-mid |
// bigboard-full | gravity-full | ultimate-busy | cube-busy (tools/lookdev-measure).
// Notakto with three boards, the first one dead, is the most pieces on the table; the full
// Big board, a draw, has 25 pieces, 12 of them rings; the full Gravity board, a draw, has
// 36 pieces, 18 of them rings. Ultimate's busiest position in 300 seeded games (Keen and
// Casual) has 48 marks, 26 of them rings, and two claimed boards: the most triangles. Cube's
// busiest game in 200 seeded games of Keen against Keen ends with 29 pieces on the grown cube.
const SCENES: Record<string, { mode: ModeId; moves: number[]; boards?: number; cursor?: number }> =
  {
    "vanishing-mid": { mode: "vanishing", moves: [0, 4, 8, 2, 6, 3], cursor: 1 },
    "classic-won": { mode: "classic", moves: [4, 1, 0, 8, 6, 3, 2] },
    "notakto-mid": { mode: "notakto", boards: 3, moves: [0, 1, 2, 13, 9, 26, 18], cursor: 22 },
    "bigboard-full": {
      mode: "bigboard",
      moves: [
        12, 8, 6, 18, 13, 11, 17, 7, 3, 9, 14, 4, 15, 1, 24, 2, 20, 5, 21, 22, 10, 19, 23, 0, 16,
      ],
    },
    "gravity-full": {
      mode: "gravity",
      moves: [
        35, 33, 29, 31, 34, 25, 28, 22, 19, 13, 16, 23, 32, 10, 27, 4, 17, 11, 30, 5, 21, 26, 15,
        20, 7, 9, 3, 14, 24, 18, 1, 12, 8, 2, 6, 0,
      ],
    },
    "ultimate-busy": {
      mode: "ultimate",
      moves: [
        68, 46, 16, 66, 35, 73, 14, 45, 8, 77, 47, 20, 25, 64, 9, 4, 37, 11, 24, 57, 32, 52, 71, 75,
        29, 23, 49, 42, 55, 15, 61, 65, 26, 80, 79, 70, 67, 39, 36, 1, 10, 17, 74, 38, 40, 44, 78,
        60, 59, 51, 54, 5, 53, 72, 6, 56,
      ],
    },
    "cube-busy": {
      mode: "cube",
      moves: [
        12, 38, 48, 44, 0, 36, 4, 15, 61, 55, 65, 35, 75, 66, 58, 85, 110, 57, 23, 42, 11, 17, 12,
        13, 16, 8, 21, 76, 22,
      ],
    },
  };
const scene = SCENES[new URL(location.href).searchParams.get("scene") ?? ""];
if (scene) {
  saving = false;
  const m = new Match(
    {
      mode: scene.mode,
      opponent: "friend",
      level: "casual",
      side: "first",
      boards: scene.boards ?? 1,
      fair: false,
    },
    1,
  );
  start(m);
  for (const c of scene.moves.slice(0, -1)) m.play(c);
  play(scene.moves.at(-1) as number);
  if (scene.cursor !== undefined) setCursor(scene.cursor);
}

await ensureTable();
hooks.ready = true;
hooks.readyMs = performance.now();
if (quality.orbit && table) void measure(table);
if (new URL(location.href).searchParams.get("search") === "1") void measureSearch();

/** Prints a measurement line, and in the desktop app's measurement run prints it and quits. */
function report(line: string) {
  const out = $("measure");
  out.hidden = false;
  out.textContent = line;
  const tauri = (window as { __TAURI__?: { core: { invoke(c: string, a: object): unknown } } })
    .__TAURI__;
  void tauri?.core.invoke("report", { msg: line });
}

/**
 * On-device check of the searching computers' time (GDD §4.1: 100 ms a move): open with
 * ?search=1. Per mode with a search (ModeInfo.search), seeded games, Sharp against Keen and
 * Casual, in the worker; the time is the worker's own.
 */
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)] ?? 0;
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

async function measureSearch() {
  const stat = (a: number[]) =>
    `mean ${mean(a).toFixed(1)} ms, p95 ${pct(a, 0.95).toFixed(1)}, max ${Math.max(...a).toFixed(1)} (${a.length} moves)`;
  const lines: string[] = [];
  $("measure").hidden = false;
  // The measurement lines stay in English: they name a mode by its ID.
  for (const { id: name, search, mode } of Object.values(MODES) as AnyModeInfo[]) {
    if (!search) continue;
    $("measure").textContent = `Measuring the ${name} search…`;
    const times: Record<Level, number[]> = { casual: [], keen: [], sharp: [] };
    for (let g = 0; g < 8; g++) {
      const levels: [Level, Level] = g % 4 < 2 ? ["sharp", "keen"] : ["sharp", "casual"];
      const rngs = [createRng(g * 2 + 1).state(), createRng(g * 2 + 2).state()];
      let s = mode.init(g % 2 ? "O" : "X");
      for (let ply = 0; !s.result; ply++) {
        const side = (ply + g) % 2;
        const reply = await search(s, levels[side] as Level, rngs[side] as (typeof rngs)[0]);
        rngs[side] = reply.rng;
        times[levels[side] as Level].push(reply.ms);
        s = mode.apply(s, reply.move);
      }
    }
    lines.push(
      `${name} search: sharp ${stat(times.sharp)}; keen ${stat(times.keen)}; casual ${stat(times.casual)}`,
    );
  }
  report(lines.join(" | "));
}

/** On-device check of the frame budget: open with ?orbit=1 (and a scene). */
async function measure(t: TableView) {
  const out = $("measure");
  out.hidden = false;
  out.textContent = "Measuring 240 frames…";
  await new Promise((r) => setTimeout(r, 1000));
  const { intervals, costs } = await t.measureOrbit(240);
  const p95 = (a: number[]) => pct(a, 0.95);
  const s = t.stats();
  // A missed refresh shows as about two refresh intervals; WebKitGTK rounds timestamps to
  // whole milliseconds, so 16.7 ms frames read as 16 and 17 (TTT-3.2 research).
  const missed = intervals.filter((i) => i > 25).length;
  out.textContent =
    `${quality.gfx}: frame ${mean(intervals).toFixed(1)} ms (p95 ${p95(intervals).toFixed(1)}, ` +
    `p99 ${pct(intervals, 0.99).toFixed(1)}, max ${Math.max(...intervals).toFixed(1)}, ` +
    `${missed} of ${intervals.length} over 25 ms), ` +
    `render ${mean(costs).toFixed(1)} ms (p95 ${p95(costs).toFixed(1)}), ` +
    `${s.drawCalls} draw calls`;
  // The desktop app's measurement run prints the line and quits (src-tauri, TTT_MEASURE).
  report(`${out.textContent}; gpu ${s.gpu}`);
}
