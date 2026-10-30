// The modes as the app sees them: rules, the solved table or the search, and how to show
// a position (cells, marks about to vanish, dead and claimed boards).
import { bigBoard } from "../core/bigboard";
import { type ClassicState, classic } from "../core/classic";
import { CUBE_CAP, CUBE_SIZE, cube, cubeGrown, cubePlacedAt } from "../core/cube";
import { GRAVITY_SIZE, gravity, landing } from "../core/gravity";
import { misere } from "../core/misere";
import { misereWild, wildCell, wildMark, wildMove } from "../core/misere-wild";
import { CENTRE, type MorrisState, morris, landing as morrisLanding } from "../core/morris";
import {
  type NestingState,
  nesting,
  nestLanding,
  nestSizes,
  nestTops,
  reserveOf,
} from "../core/nesting";
import { type NotaktoState, notakto } from "../core/notakto";
import {
  OC_SIZE,
  type OrderChaosState,
  ocCell,
  ocMark,
  ocMove,
  orderChaos,
} from "../core/order-chaos";
import { grown, overtime, placedAt } from "../core/overtime";
import type { Level } from "../core/players";
import type { Rng, RngState } from "../core/rng";
import { type SaucerState, saucer, type Visit, visitNow } from "../core/saucer";
import { SOLVED_TABLES } from "../core/solved-tables";
import type { Solution } from "../core/solver";
import { type SolvedTable, tableSolution } from "../core/table";
import type { Mark, Mode, Side } from "../core/types";
import { boardOf, fairStart, type UltimateState, ultimate } from "../core/ultimate";
import {
  cellsOf,
  EDGE_CELLS,
  nextToVanish,
  type VanishingState,
  vanishing,
} from "../core/vanishing";
import type { SearchMode, SearchReply, SearchRequest, SearchState } from "./search.worker";

export type ModeId =
  | "classic"
  | "vanishing"
  | "misere"
  | "misere-wild"
  | "morris"
  | "saucer"
  | "nesting"
  | "notakto"
  | "bigboard"
  | "overtime"
  | "gravity"
  | "order-chaos"
  | "ultimate"
  | "cube";

/** A mode's name, rule and fairness are messages in src/ui/locales/ (`mode-<id>-rule`…). */
export interface ModeInfo<S> {
  readonly id: ModeId;
  /** Notakto: both sides place the same neutral X (N1). */
  readonly neutral: boolean;
  /**
   * Notakto: the player chooses one, two or three boards (N1); with perfect play the first
   * side wins on an odd number (§3.7), which the setup card tells a player facing the computer.
   */
  readonly boards?: { firstWins(boards: number): boolean };
  /**
   * Vanishing: marks fade before they go (V6). The panel keeps a line for the note on them,
   * so its height holds during play.
   */
  readonly fades?: boolean;
  /** Vanishing and Saucer: why the first move may not go on `cell` (V3, S2), or null. */
  openingRefusal?(cell: number): "edge" | "centre" | null;
  /**
   * Misère wild and Order and Chaos: the side to move chooses the mark it places (W1, OC1),
   * and a move names the mark as well as the cell (W4, OC4).
   */
  readonly wild?: {
    move(cell: number, mark: Side): number;
    cell(move: number): number;
    mark(move: number): Side;
  };
  /** Order and Chaos: the side playing Order (OC1); the other plays Chaos. */
  order?(state: S): Side;
  /**
   * Three men's morris: once a side's three pieces are down, a move slides one of them to
   * a neighbouring empty cell (TM2); the player picks the piece, then the cell.
   */
  readonly slides?: boolean;
  /**
   * Nesting: pieces come in three sizes, and a larger one covers a smaller one (NE1, NE2).
   * `sizes` is each cell's top piece size (0 small to 2 large, −1 empty); `reserve` the
   * pieces of a size a side has left off the board. The player picks a piece from the tray
   * beside the board or one of their top pieces, then the cell.
   */
  readonly nest?: {
    sizes(state: S): number[];
    reserve(state: S, side: Side, size: number): number;
  };
  /** Ultimate: boards per row of a grid of boards (3). Without it the boards stand in a row. */
  readonly columns?: number;
  readonly mode: Mode<S>;
  /**
   * Not in the cabinet: the mode keeps its code, tests, saves and scenes, but no drawer
   * shows it. Cube, until it is a real 3D cube David approves (P28, After release).
   */
  readonly hidden?: true;
  /** Cells along a board's side at the start: 3, 5 on the Big board, 6 in Gravity, 4 in Cube. */
  readonly size: number;
  /** Saucer: the visit after the last move, if there was one (S3). */
  visit?(state: S): Visit | null;
  /** Saucer: whether the saucer takes the piece the side to move places now (S3). */
  visitNext?(state: S): boolean;
  /** Overtime and Cube: the side now, 3 or 4, then 5 once the board or cube has grown (O2, C3). */
  sizeOf?(state: S): number;
  /** Overtime and Cube: where the mark of `cell`, just played, sits now; the growth moves it. */
  placedAt?(state: S, cell: number): number;
  /**
   * Cube: the boards are the cube's layers, from the bottom, one per entry of `dead`, and a
   * line can run through several of them (C2).
   */
  readonly layers?: boolean;
  /** Gravity: the board stands upright and a move picks a column (G1). */
  readonly upright: boolean;
  /**
   * The cell a pick of `cell` plays: in Gravity its column's lowest empty cell (G1), or null
   * when the column is full.
   */
  aim(state: S, cell: number): number | null;
  /** The start position; `boards` is read by Notakto only. */
  start(first: Side, boards: number): S;
  /** Ultimate's "Fair start" (U6): random opening moves from the game's generator. */
  fairStart?(state: S, rng: Rng): S;
  cells(state: S): Mark[];
  /** Cells whose mark vanishes on that side's next placement (V6). */
  fading(state: S): number[];
  /**
   * Per board, the line that killed or claimed it, an empty line for a board that filled
   * without one (Ultimate), or null while it is live; one board outside Notakto and Ultimate.
   */
  dead(state: S): ReadonlyArray<readonly number[] | null>;
  /** Ultimate: per board, the side that claimed it (U4). */
  claimed?(state: S): ReadonlyArray<Side | null>;
  /** Ultimate: the boards the side to move may play in, which glow (U2, U3). */
  targets?(state: S): number[];
  /** The small solved modes: their shipped table, for the computer and the hint (R9). */
  readonly loadSolution: (() => Promise<Solution<S>>) | null;
  /** The line games and Ultimate: the computer's move, searched in a Web Worker; it advances `rng`. */
  readonly search: ((state: S, level: Level, rng: RngState) => Promise<SearchReply>) | null;
}

/** Fetches a shipped table once (made by `npm run tables`). */
function tableLoader<S>(t: SolvedTable<S>) {
  let cached: Promise<Solution<S>> | null = null;
  return () => {
    cached ??= fetch(`./assets/${t.id}_table.bin`)
      .then((r) => {
        if (!r.ok) throw new Error(`${t.id} table: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => tableSolution(t, new Uint8Array(b)));
    cached.catch(() => {
      cached = null; // let a later game try again
    });
    return cached;
  };
}

let worker: Worker | null = null;
let lastId = 0;
const waiting = new Map<number, { ok(r: SearchReply): void; fail(e: unknown): void }>();

/** Runs one search in the shared worker, started on first use. */
const searchInWorker =
  <S extends SearchState>(mode: SearchMode) =>
  (state: S, level: Level, rng: RngState): Promise<SearchReply> => {
    if (!worker) {
      const w = new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<SearchReply>) => {
        waiting.get(e.data.id)?.ok(e.data);
        waiting.delete(e.data.id);
      };
      // A crash or an unreadable reply fails every waiting search; the next one starts afresh.
      const fail = (e: Event) => {
        for (const p of waiting.values()) p.fail(e);
        waiting.clear();
        w.terminate();
        worker = null;
      };
      w.onerror = fail;
      w.onmessageerror = fail;
      worker = w;
    }
    const request: SearchRequest = { id: ++lastId, mode, state, level, rng };
    const reply = new Promise<SearchReply>((ok, fail) => waiting.set(request.id, { ok, fail }));
    worker.postMessage(request);
    return reply;
  };

/** A flat board: a pick plays the cell itself. */
const FLAT = { upright: false, aim: (_: unknown, cell: number) => cell } as const;

export const MODES = {
  classic: {
    id: "classic",
    neutral: false,
    mode: classic,
    size: 3,
    ...FLAT,
    start: (first) => classic.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: tableLoader(SOLVED_TABLES.classic),
    search: null,
  } satisfies ModeInfo<ReturnType<typeof classic.init>>,
  vanishing: {
    id: "vanishing",
    neutral: false,
    mode: vanishing,
    size: 3,
    ...FLAT,
    fades: true,
    openingRefusal: (cell) => (EDGE_CELLS.includes(cell) ? "edge" : null),
    start: (first) => vanishing.init(first),
    cells: cellsOf,
    fading: (s: VanishingState) =>
      [nextToVanish(s, "X"), nextToVanish(s, "O")].filter((c): c is number => c !== null),
    dead: () => [null],
    loadSolution: tableLoader(SOLVED_TABLES.vanishing),
    search: null,
  } satisfies ModeInfo<VanishingState>,
  misere: {
    id: "misere",
    neutral: false,
    mode: misere,
    size: 3,
    ...FLAT,
    start: (first) => misere.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: tableLoader(SOLVED_TABLES.misere),
    search: null,
  } satisfies ModeInfo<ReturnType<typeof misere.init>>,
  "misere-wild": {
    id: "misere-wild",
    neutral: false,
    wild: { move: wildMove, cell: wildCell, mark: wildMark },
    mode: misereWild,
    size: 3,
    ...FLAT,
    placedAt: (_, move) => wildCell(move),
    start: (first) => misereWild.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: tableLoader(SOLVED_TABLES["misere-wild"]),
    search: null,
  } satisfies ModeInfo<ClassicState>,
  morris: {
    id: "morris",
    neutral: false,
    slides: true,
    mode: morris,
    size: 3,
    ...FLAT,
    placedAt: (_, move) => morrisLanding(move),
    start: (first) => morris.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: tableLoader(SOLVED_TABLES.morris),
    search: null,
  } satisfies ModeInfo<MorrisState>,
  saucer: {
    id: "saucer",
    neutral: false,
    mode: saucer,
    size: 3,
    ...FLAT,
    visit: (s) => s.visit,
    visitNext: visitNow,
    openingRefusal: (cell) => (cell === CENTRE ? "centre" : null),
    start: (first) => saucer.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: tableLoader(SOLVED_TABLES.saucer),
    search: null,
  } satisfies ModeInfo<SaucerState>,
  nesting: {
    id: "nesting",
    neutral: false,
    nest: { sizes: nestSizes, reserve: reserveOf },
    mode: nesting,
    size: 3,
    ...FLAT,
    placedAt: (_, move) => nestLanding(move),
    start: (first) => nesting.init(first),
    cells: nestTops,
    fading: () => [],
    dead: () => [null],
    loadSolution: null,
    search: searchInWorker("nesting"),
  } satisfies ModeInfo<NestingState>,
  notakto: {
    id: "notakto",
    neutral: true,
    boards: { firstWins: (boards) => boards % 2 === 1 },
    mode: notakto,
    size: 3,
    ...FLAT,
    start: (first, boards) => notakto.init(first, boards),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: (s) => s.dead,
    loadSolution: tableLoader(SOLVED_TABLES.notakto),
    search: null,
  } satisfies ModeInfo<NotaktoState>,
  bigboard: {
    id: "bigboard",
    neutral: false,
    mode: bigBoard,
    size: 5,
    ...FLAT,
    start: (first) => bigBoard.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: null,
    search: searchInWorker("bigboard"),
  } satisfies ModeInfo<ClassicState>,
  overtime: {
    id: "overtime",
    neutral: false,
    mode: overtime,
    size: 3,
    sizeOf: (s) => (grown(s) ? 5 : 3),
    placedAt,
    ...FLAT,
    start: (first) => overtime.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: null,
    search: searchInWorker("overtime"),
  } satisfies ModeInfo<ClassicState>,
  gravity: {
    id: "gravity",
    neutral: false,
    mode: gravity,
    size: GRAVITY_SIZE,
    upright: true,
    aim: (s, cell) => landing(s.cells, cell),
    start: (first) => gravity.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: null,
    search: searchInWorker("gravity"),
  } satisfies ModeInfo<ClassicState>,
  "order-chaos": {
    id: "order-chaos",
    neutral: false,
    wild: { move: ocMove, cell: ocCell, mark: ocMark },
    order: (s) => s.order,
    mode: orderChaos,
    size: OC_SIZE,
    ...FLAT,
    placedAt: (_, move) => ocCell(move),
    start: (first) => orderChaos.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: () => [null],
    loadSolution: null,
    search: searchInWorker("order-chaos"),
  } satisfies ModeInfo<OrderChaosState>,
  ultimate: {
    id: "ultimate",
    neutral: false,
    mode: ultimate,
    size: 3,
    columns: 3,
    ...FLAT,
    start: (first) => ultimate.init(first),
    fairStart,
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: (s) => s.boards.map((b, i) => (b === null ? null : (s.claims[i] ?? []))),
    claimed: (s) => s.boards.map((b) => (b === "X" || b === "O" ? b : null)),
    targets: (s) => [...new Set(ultimate.legalMoves(s).map(boardOf))],
    loadSolution: null,
    search: searchInWorker("ultimate"),
  } satisfies ModeInfo<UltimateState>,
  cube: {
    id: "cube",
    hidden: true,
    neutral: false,
    mode: cube,
    size: CUBE_SIZE,
    sizeOf: (s) => (cubeGrown(s) ? CUBE_CAP : CUBE_SIZE),
    placedAt: cubePlacedAt,
    layers: true,
    ...FLAT,
    start: (first) => cube.init(first),
    cells: (s) => [...s.cells],
    fading: () => [],
    dead: (s) => Array(cubeGrown(s) ? CUBE_CAP : CUBE_SIZE).fill(null),
    loadSolution: null,
    search: searchInWorker("cube"),
  } satisfies ModeInfo<ClassicState>,
} as const;

// biome-ignore lint/suspicious/noExplicitAny: the app handles every mode through one interface
export type AnyModeInfo = ModeInfo<any>;
