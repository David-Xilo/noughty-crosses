// One game and its rematches: the record {mode, setup, seed, moves} (GDD R6, R7, §8), the
// side choice (R8) and the computer's turns. No DOM here.
import { firstMissedWin, firstMistake, type Hint } from "../core/hint";
import { type Level, levelPlayer } from "../core/players";
import { createRng, type RngState } from "../core/rng";
import type { Outcome, Solution } from "../core/solver";
import { other, type Side } from "../core/types";
import { type AnyModeInfo, MODES, type ModeId } from "./modes";

export type Opponent = "computer" | "friend";
export type SidePref = "first" | "second" | "alternate";

export interface Setup {
  readonly mode: ModeId;
  readonly opponent: Opponent;
  readonly level: Level;
  /** Against the computer: whether the player moves first (R8). */
  readonly side: SidePref;
  /** Notakto: one to three boards (N1); other modes ignore it. */
  readonly boards: number;
  /** Ultimate: "Fair start", the first four moves random (U6); other modes ignore it. */
  readonly fair: boolean;
}

/** Against the computer the player always has the light X pieces. */
export const HUMAN: Side = "X";

interface GameRecord {
  readonly setup: Setup;
  readonly first: Side;
  readonly seed: number;
  readonly moves: readonly number[];
}

/** A computer move, and the generator's state after it. */
interface Reply {
  readonly move: number;
  readonly rng: RngState;
}

export class Match<S = unknown> {
  readonly info: AnyModeInfo;
  record: GameRecord;
  state: S;
  /** The start position: with a fair start, after the random opening (U6). */
  private readonly initial: S;
  /** The moves of a fair start's random opening (U6), or 0; they are not in the record. */
  readonly opening: number;
  /**
   * The game's generator after the opening and the computer's moves so far: the computer
   * continues it, and a save keeps it (R6).
   */
  rng: RngState;
  private computer: ((state: S) => Promise<Reply>) | null = null;
  private solution: Solution<S> | null = null;
  private pending: { ply: number; reply: Promise<Reply>; done?: Reply } | null = null;
  /** The position and generator before each move of the record, for undo. */
  private history: { state: S; rng: RngState }[] = [];

  constructor(
    readonly setup: Setup,
    seed: number,
    first: Side = setup.opponent === "friend" || setup.side !== "second" ? "X" : "O",
  ) {
    this.info = MODES[setup.mode];
    this.record = { setup, first, seed, moves: [] };
    // R6: the opening and the computer draw from one generator, seeded by the record.
    const rng = createRng(seed);
    const start = this.info.start(first, setup.boards);
    this.initial = setup.fair && this.info.fairStart ? this.info.fairStart(start, rng) : start;
    const marks = (s: S) => this.info.cells(s).filter((c) => c !== null).length;
    this.opening = marks(this.initial) - marks(start);
    this.rng = rng.state();
    this.state = this.initial;
  }

  /**
   * Readies the computer: a solved mode loads its table, which the hint also needs; a line
   * game searches in a worker, which hands the generator's state back after each move. Each
   * computer move starts from `rng`, so an undo that rewinds it gets the same reply again.
   */
  async prepare(): Promise<void> {
    if (this.setup.opponent !== "computer") return;
    const { search, loadSolution } = this.info;
    if (search) {
      this.computer = (s) => search(s, this.setup.level, this.rng);
      return;
    }
    if (!loadSolution) throw new Error(`${this.setup.mode}: no computer`);
    const solution = await loadSolution();
    this.solution = solution;
    this.computer = async (s) => {
      const gen = createRng(this.rng);
      const move = levelPlayer(this.setup.level, this.info.mode, solution, gen)(s);
      return { move, rng: gen.state() };
    };
  }

  get toMove(): Side {
    return this.info.mode.toMove(this.state);
  }
  get result() {
    return this.info.mode.result(this.state);
  }
  get computerToMove(): boolean {
    return this.setup.opponent === "computer" && !this.result && this.toMove !== HUMAN;
  }
  legal(): number[] {
    return this.info.mode.legalMoves(this.state);
  }

  /** Plays a move; returns false if it is illegal (R2). */
  play(cell: number): boolean {
    const next = this.info.mode.apply(this.state, cell);
    if (next === this.state) return false;
    this.history.push({ state: this.state, rng: this.rng });
    // The computer's move: the generator moves on with it.
    const ply = this.record.moves.length;
    if (this.computerToMove && this.pending?.ply === ply && this.pending.done?.move === cell)
      this.rng = this.pending.done.rng;
    this.state = next;
    this.record = { ...this.record, moves: [...this.record.moves, cell] };
    return true;
  }

  /** Whether this game offers undo at all (GDD §5): against Casual and Keen. */
  get undoOffered(): boolean {
    return this.setup.opponent === "computer" && this.setup.level !== "sharp";
  }

  /**
   * Whether the player can take a move back now: during the game, once the player has
   * moved since the start or since the game was continued from a save (`resumed`).
   */
  get canUndo(): boolean {
    const mode = this.info.mode;
    return (
      this.undoOffered && !this.result && this.history.some((h) => mode.toMove(h.state) === HUMAN)
    );
  }

  /**
   * Takes back the player's last move and the computer's reply, if it came. The position and
   * the generator go back with them (R6), so the same move gets the same reply.
   */
  undo(): boolean {
    if (!this.canUndo) return false;
    let last: { state: S; rng: RngState };
    do {
      last = this.history.pop() as typeof last;
      this.record = { ...this.record, moves: this.record.moves.slice(0, -1) };
    } while (this.info.mode.toMove(last.state) !== HUMAN);
    this.state = last.state;
    this.rng = last.rng;
    this.pending = null;
    return true;
  }

  /**
   * Continues a game whose moves were replayed from a save, with the generator's saved
   * state. A save keeps only that state, not the one before each move, so undo reaches back
   * only to here.
   */
  resumed(rng: RngState): void {
    this.rng = rng;
    this.history = [];
  }

  /**
   * The computer's choice for the current position; seeded by the game record (R6). A turn
   * that is cancelled and resumed gets the same pending choice, so the generator advances
   * once per computer move.
   */
  computerMove(): Promise<number> {
    if (!this.computer) return Promise.reject(new Error("computer not prepared"));
    const ply = this.record.moves.length;
    if (this.pending?.ply !== ply) {
      const reply = this.computer(this.state);
      const pending: NonNullable<typeof this.pending> = { ply, reply };
      reply.then(
        (r) => {
          pending.done = r;
        },
        () => {
          if (this.pending === pending) this.pending = null; // a failed search is tried again
        },
      );
      this.pending = pending;
    }
    return this.pending.reply.then((r) => r.move);
  }

  /** Whether the mode is solved, so the result can name the player's first mistake (§4.2). */
  get solved(): boolean {
    return this.info.loadSolution !== null;
  }

  /** Who wins this game with perfect play from the start; null before `prepare`. */
  solvedStart(): Outcome | null {
    return this.solution ? this.solution.value(this.initial).outcome : null;
  }

  /**
   * The player's first mistake, against the computer only (R9). After a repetition or
   * ply-cap draw (V4, V5) it can instead be a forced win the player let go.
   */
  hint(): { hint: Hint; missedWin: boolean } | null {
    if (!this.solution) return null;
    const args = [this.info.mode, this.solution, this.initial, this.record.moves, HUMAN] as const;
    const mistake = firstMistake(...args);
    if (mistake) return { hint: mistake, missedWin: false };
    const r = this.result;
    const missed = r?.kind === "draw" && r.reason !== "board-full" ? firstMissedWin(...args) : null;
    return missed ? { hint: missed, missedWin: true } : null;
  }

  /** The next game: the starting side swaps in pass-and-play and with "alternate" (R8). */
  rematch(seed: number): Match<S> {
    const swap = this.setup.opponent === "friend" || this.setup.side === "alternate";
    return new Match<S>(this.setup, seed, swap ? other(this.record.first) : this.record.first);
  }
}
