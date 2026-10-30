// The rule cards' demos (GDD §3, §12): one short, real game per mode, replayed through the
// rules core, with a caption from the ply it is keyed to. test/app/demos.test.ts checks that
// each one is legal and ends as its captions say. No DOM and no text here.
import type { ModeId } from "./modes";

interface Demo {
  readonly moves: readonly number[];
  /** Notakto: the board count. */
  readonly boards: number;
  /**
   * The numbers of moves shown at which a caption starts; each holds until the next one.
   * The captions are the messages `demo-<mode>-<moves>` in src/ui/locales/.
   */
  readonly captions: readonly number[];
}

export const DEMOS: Record<ModeId, Demo> = {
  classic: {
    moves: [0, 1, 4, 8, 6, 3, 2],
    boards: 1,
    captions: [0, 5, 6, 7],
  },
  vanishing: {
    moves: [0, 4, 8, 2, 6, 3, 7],
    boards: 1,
    captions: [0, 5, 6, 7],
  },
  misere: {
    moves: [4, 0, 1, 6, 2, 7, 5, 3],
    boards: 1,
    captions: [0, 1, 7, 8],
  },
  // Moves 9–17 place an O (W4). After seven marks both empty cells complete a line of X
  // and a line of O.
  "misere-wild": {
    moves: [4, 0, 1, 3, 11, 15, 17, 16],
    boards: 1,
    captions: [0, 1, 7, 8],
  },
  // Moves 9–89 slide a piece (TM5): 40 is 3 to 4, 56 is 5 to 2, 10 is 0 to 1. X's slide
  // into the centre lines up the middle column, and O leaves its top cell open.
  morris: {
    moves: [0, 8, 3, 6, 7, 5, 40, 56, 10],
    boards: 1,
    captions: [0, 6, 7, 9],
  },
  // X's 6 is pushed to 3 (S3), O's centre piece is carried off, and X's 7 is pushed to 6,
  // beside 0 and 3 (S4).
  saucer: {
    moves: [1, 2, 6, 5, 8, 4, 0, 4, 7],
    boards: 1,
    captions: [0, 3, 6, 9],
  },
  // Moves 0–26 place a piece: size × 9 + cell, small 0 to large 2 (NE6). X's two large
  // pieces, on 4 and 8, cannot be covered: O blocks the diagonal, and X takes 5.
  nesting: {
    moves: [22, 2, 11, 24, 26, 18, 5],
    boards: 1,
    captions: [0, 3, 5, 7],
  },
  notakto: {
    moves: [4, 0, 1, 5, 6, 2],
    boards: 1,
    captions: [0, 1, 5, 6],
  },
  bigboard: {
    moves: [12, 11, 7, 13, 17, 2, 22],
    boards: 1,
    captions: [0, 5, 6, 7],
  },
  // A Classic draw grows the board (O2); the 3×3 marks move to its centre, where X and O
  // each hold two cells of a diagonal of four. X leaves O's open.
  overtime: {
    moves: [4, 0, 2, 6, 3, 5, 1, 7, 8, 9, 3, 21],
    boards: 1,
    captions: [0, 9, 10, 12],
  },
  gravity: {
    moves: [32, 26, 33, 27, 31, 34, 30],
    boards: 1,
    captions: [0, 5, 6, 7],
  },
  // Moves 36–71 place an O (OC4). Order's X go down the third column; Chaos's O go beside
  // it, until Chaos leaves both ends of four X open.
  "order-chaos": {
    moves: [14, 49, 20, 57, 8, 45, 26, 38, 32],
    boards: 1,
    captions: [0, 5, 7, 9],
  },
  ultimate: {
    moves: [36, 4, 44, 76, 40],
    boards: 1,
    captions: [0, 1, 5],
  },
  // X's row on the bottom layer is blocked by O and the cube's edge. The 7th mark grows the
  // cube (C3); the new right face gives the row a fourth cell, and O does not block it.
  cube: {
    moves: [1, 63, 2, 0, 3, 62, 21, 104, 9],
    boards: 1,
    captions: [0, 5, 7, 9],
  },
};
