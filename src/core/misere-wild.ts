// Misère wild: on each turn the side to move places an X or an O, and whoever completes
// three of one mark in a row loses (docs/gdd.md §3.8, rules W1–W4). It shares Classic's
// state and position rank; a move names its mark as well as its cell (W4).
import { type ClassicState, classic } from "./classic";
import { lineThrough, type Mark, type Mode, other } from "./types";

/** W4: moves 0–8 place an X on that cell, 9–17 an O on cell move − 9. */
export const wildMove = (cell: number, mark: "X" | "O") => cell + (mark === "O" ? 9 : 0);
export const wildCell = (move: number) => move % 9;
export const wildMark = (move: number): "X" | "O" => (move < 9 ? "X" : "O");

export const misereWild: Mode<ClassicState> = {
  ...classic,
  id: "misere-wild",
  legalMoves: (s) =>
    s.result ? [] : [0, 9].flatMap((o) => s.cells.flatMap((m, i) => (m === null ? [i + o] : []))),
  apply(s, move) {
    if (s.result || !Number.isInteger(move) || move < 0 || move > 17) return s; // R2
    const cell = wildCell(move);
    if (s.cells[cell] !== null) return s;
    const mark: Mark = wildMark(move);
    const cells = s.cells.slice();
    cells[cell] = mark;
    const moves = [...s.moves, move];
    // W2: a line of either mark is the mover's doing, and the other side wins.
    const line = lineThrough(cells, cell, mark);
    if (line)
      return {
        cells,
        toMove: s.toMove,
        moves,
        result: { kind: "win", winner: other(s.toMove), line },
      };
    if (!cells.includes(null))
      return { cells, toMove: s.toMove, moves, result: { kind: "draw", reason: "board-full" } };
    return { cells, toMove: other(s.toMove), moves, result: null };
  },
};
