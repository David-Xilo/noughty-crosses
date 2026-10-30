// Shared rule types (docs/gdd.md, section 2).

export type Side = "X" | "O";
export type Mark = Side | null;

/**
 * How a game ended. `line` holds the winning cells (Ultimate: the centre cells of the three
 * boards); `reason` explains a draw ("no-line": Ultimate's U5; "dead-board": Overtime's O5,
 * no line of four open for either side).
 */
export type Result =
  | { kind: "win"; winner: Side; line: readonly number[] }
  | { kind: "draw"; reason: "board-full" | "repetition" | "ply-cap" | "no-line" | "dead-board" };

/** The common interface every mode implements. States are immutable plain data (R7). */
export interface Mode<S> {
  readonly id: string;
  readonly cells: number;
  init(first?: Side): S;
  /** Legal cells for the side to move; empty when the game is over. */
  legalMoves(state: S): number[];
  /** Applies a move. Illegal moves return the same state object unchanged (R2). */
  apply(state: S, cell: number): S;
  result(state: S): Result | null;
  toMove(state: S): Side;
  /** A key identifying the position for repetition and solving. */
  key(state: S): string;
}

export const other = (s: Side): Side => (s === "X" ? "O" : "X");

/** The eight lines of a 3×3 board (k = 3). */
export const LINES_3x3: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Every line of k cells on a width × height board (row-major): rows, columns, diagonals. */
export function linesOf(width: number, height: number, k: number): number[][] {
  const lines: number[][] = [];
  const steps = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ] as const;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (const [dx, dy] of steps) {
        const ex = x + dx * (k - 1);
        const ey = y + dy * (k - 1);
        if (ex < 0 || ex >= width || ey >= height) continue;
        lines.push(Array.from({ length: k }, (_, j) => (y + dy * j) * width + x + dx * j));
      }
  return lines;
}

/** The line completed by `side` that passes through `cell`, if any (no full-board scan). */
export function lineThrough(
  cells: readonly Mark[],
  cell: number,
  side: Side,
  lines: ReadonlyArray<readonly number[]> = LINES_3x3,
): readonly number[] | null {
  for (const line of lines) {
    if (line.includes(cell) && line.every((i) => cells[i] === side)) return line;
  }
  return null;
}
