// The board model: what the table and the 2D board show of one position. It has no
// Three.js, so the menus and the 2D board load without the 3D table's chunk.
type Side = "X" | "O";

/** What the table shows: the rules core's view of one position. */
export interface BoardModel {
  readonly cells: ReadonlyArray<Side | null>;
  /** Marks that vanish on their side's next placement, shown fading (V6). */
  readonly fading: readonly number[];
  readonly line: readonly number[] | null;
  /** Misère and Notakto: the line was made by the side that lost (M2, N3). */
  readonly lineLoses: boolean;
  readonly outcome: "win" | "draw" | null;
  /**
   * Per board, the line that killed or claimed it, an empty line for a full board (Ultimate),
   * or null; one entry per board (Notakto: 1–3; Ultimate: 9).
   */
  readonly dead: ReadonlyArray<readonly number[] | null>;
  /** Ultimate: per board, the side that claimed it; one large piece replaces its marks (U4). */
  readonly claimed: ReadonlyArray<Side | null>;
  /** Ultimate: the boards the side to move may play in, which glow (U2, U3). */
  readonly targets: readonly number[];
  /** Boards per row: Ultimate's nine in three rows; otherwise every board in one row. */
  readonly columns?: number;
  /** Notakto: every mark is the neutral pewter X. */
  readonly neutral: boolean;
  /** Cells along a board's side: 3, 5 on the Big board, 6 in Gravity, 4 then 5 in Cube. */
  readonly size: number;
  /**
   * Cube: the boards are the cube's layers, from the bottom (one entry of `dead` each), and a
   * line can run through several of them (C2).
   */
  readonly layers: boolean;
  /** Gravity: the board stands upright, row 1 at the top, and marks drop down a column. */
  readonly upright: boolean;
  /** Three men's morris and Nesting: the piece the player picked up to move (TM2, NE2). */
  readonly selected?: number | null;
  /** Nesting: per cell, the top piece's size, 0 small to 2 large, −1 empty (NE1). */
  readonly sizes?: readonly number[];
  /** Nesting: the size of the piece the player holds, for the ghost (NE2). */
  readonly ghostSize?: number;
  /** Saucer: the saucer waits by the board; it takes the next piece placed (S3). */
  readonly saucerWaits?: boolean;
  /**
   * Saucer: the visit after the last move (S3): the piece placed on `from` pushed to `to`,
   * left (`to` is `from`) or carried off (null). `ply` tells one visit from the next.
   */
  readonly visit?: SaucerVisit | null;
}

export interface SaucerVisit {
  readonly side: Side;
  readonly from: number;
  readonly to: number | null;
  readonly ply: number;
}

/**
 * Saucer: a visit's whole flight in ms, on the 3D table and the 2D board; the computer's
 * reply waits as long (S3).
 */
export const VISIT_MS = 1700;

/** Ultimate: the winning line runs across boards, through three claimed ones (U5). */
export const lineAcross = (m: BoardModel) =>
  !m.layers && !!m.line && new Set(m.line.map((c) => Math.floor(c / m.size ** 2))).size > 1;

/** Cube: the 2D layers in rows of two (4 layers) or three (5 layers). */
export const layerColumns = (layers: number) => Math.ceil(layers / 2);

/** An empty single board. */
export const EMPTY_BOARD: BoardModel = {
  cells: Array(9).fill(null),
  fading: [],
  line: null,
  lineLoses: false,
  outcome: null,
  dead: [null],
  neutral: false,
  size: 3,
  layers: false,
  upright: false,
  claimed: [],
  targets: [],
};
