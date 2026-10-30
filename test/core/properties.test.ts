// Property tests: random legal move sequences keep every rule invariant (testing-qa guideline).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BIG_LINES, bigBoard } from "../../src/core/bigboard";
import { type ClassicState, classic } from "../../src/core/classic";
import { CAP_LINES, CUBE_GROWN, CUBE_LINES, cube, cubeGrown } from "../../src/core/cube";
import { GRAVITY_LINES, GRAVITY_SIZE, gravity } from "../../src/core/gravity";
import { misere } from "../../src/core/misere";
import { type NotaktoState, notakto } from "../../src/core/notakto";
import { grown, OVERTIME_CENTRE, overtime } from "../../src/core/overtime";
import { LINES_3x3, type Mode } from "../../src/core/types";
import { type UltimateState, ultimate } from "../../src/core/ultimate";
import {
  cellsOf,
  MARKS_PER_SIDE,
  VANISHING_RULES,
  type VanishingState,
  vanishing,
} from "../../src/core/vanishing";

/** Plays `picks` as indices into the legal moves; returns every state visited. */
function walk<S>(mode: Mode<S>, picks: number[], start = mode.init()): S[] {
  const states = [start];
  for (const p of picks) {
    const s = states[states.length - 1] as S;
    const moves = mode.legalMoves(s);
    if (moves.length === 0) break;
    states.push(mode.apply(s, moves[p % moves.length] as number));
  }
  return states;
}

const picks = fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 120 });

function sharedInvariants<S extends { moves: readonly number[] }>(
  mode: Mode<S>,
  states: S[],
  start = mode.init(),
) {
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1] as S;
    const s = states[i] as S;
    // R2/R7: apply returns a new state and never mutates the old one.
    expect(s).not.toBe(prev);
    expect(s.moves.length).toBe(prev.moves.length + 1);
    // R5: a finished game accepts no more moves.
    if (mode.result(s)) expect(mode.legalMoves(s)).toEqual([]);
  }
  // R7: replaying the move list rebuilds the same state.
  const last = states[states.length - 1] as S;
  const replay = last.moves.reduce((acc, m) => mode.apply(acc, m), start);
  expect(replay).toEqual(last);
}

/** Four in a row wins exactly when it is made, by the last move; only a full board draws. */
function endsOnFour(lines: ReadonlyArray<readonly number[]>, states: ClassicState[]) {
  for (const s of states) {
    const four = lines.find((l) =>
      l.every((i) => s.cells[i] && s.cells[i] === s.cells[l[0] as number]),
    );
    const r = s.result;
    if (r?.kind === "draw") expect(s.cells.includes(null)).toBe(false);
    if (r?.kind === "win") {
      expect(r.line).toHaveLength(4);
      for (const i of r.line) expect(s.cells[i]).toBe(r.winner);
      expect(r.line).toContain(s.moves.at(-1));
    }
    expect(r?.kind === "win").toBe(!!four);
  }
}

describe("rule invariants under random legal play", () => {
  it("Classic", () => {
    fc.assert(
      fc.property(picks, (p) => {
        const states = walk<ClassicState>(classic, p);
        sharedInvariants(classic, states);
        for (const s of states) {
          const x = s.cells.filter((c) => c === "X").length;
          const o = s.cells.filter((c) => c === "O").length;
          expect(x - o === 0 || x - o === 1).toBe(true); // R1: sides alternate, X first
          const r = s.result;
          if (r?.kind === "win") for (const i of r.line) expect(s.cells[i]).toBe(r.winner);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("Misère: a line is always the loser's own, made by the last move (M2)", () => {
    fc.assert(
      fc.property(picks, (p) => {
        const states = walk<ClassicState>(misere, p);
        sharedInvariants(misere, states);
        const last = states[states.length - 1] as ClassicState;
        const r = last.result;
        if (r?.kind === "win") {
          const loser = r.winner === "X" ? "O" : "X";
          for (const i of r.line) expect(last.cells[i]).toBe(loser);
          expect(r.line).toContain(last.moves.at(-1));
        }
      }),
      { numRuns: 500 },
    );
  });

  it("Big board: the game ends exactly when four in a row is made, or on a full board (B2, B3)", () => {
    fc.assert(
      fc.property(picks, (p) => {
        const states = walk<ClassicState>(bigBoard, p);
        sharedInvariants(bigBoard, states);
        endsOnFour(BIG_LINES, states);
      }),
      { numRuns: 300 },
    );
  });

  it("Overtime: the board grows only on a 3×3 draw, keeps every mark, then ends on four or a full board (O1–O5)", () => {
    fc.assert(
      fc.property(picks, fc.boolean(), (p, oFirst) => {
        const start = overtime.init(oFirst ? "O" : "X");
        const states = walk<ClassicState>(overtime, p, start);
        sharedInvariants(overtime, states, start);
        for (const s of states.filter((s) => !grown(s))) {
          // O1: on 3×3 the game ends exactly on three in a row, and never in a draw (O2).
          const three = LINES_3x3.some((l) =>
            l.every((i) => s.cells[i] && s.cells[i] === s.cells[l[0]]),
          );
          expect(s.result?.kind === "win").toBe(three);
          expect(s.result?.kind).not.toBe("draw");
        }
        for (let i = 1; i < states.length; i++) {
          const prev = states[i - 1] as ClassicState;
          const s = states[i] as ClassicState;
          if (grown(s) && !grown(prev)) {
            // O2: the ninth mark made a draw; all nine sit in the centre, the ring is empty.
            expect(s.moves).toHaveLength(9);
            const centre = OVERTIME_CENTRE.map((c) => s.cells[c]);
            expect(centre.every((m) => m !== null)).toBe(true);
            expect(s.cells.filter((m) => m !== null)).toHaveLength(9);
            expect(s.toMove).not.toBe(prev.toMove); // O3
          }
          if (grown(prev)) expect(grown(s)).toBe(true);
        }
        endsOnFour(BIG_LINES, states.filter(grown));
      }),
      { numRuns: 500 },
    );
  });

  it("Cube: the cube grows once, after the 7th mark, keeps every mark, and ends on four or a full cube (C1–C5)", () => {
    fc.assert(
      fc.property(picks, fc.boolean(), (p, oFirst) => {
        const start = cube.init(oFirst ? "O" : "X");
        const states = walk<ClassicState>(cube, p, start);
        sharedInvariants(cube, states, start);
        for (let i = 1; i < states.length; i++) {
          const prev = states[i - 1] as ClassicState;
          const s = states[i] as ClassicState;
          // C3: it grows exactly after the 7th mark, unless that mark won; C4: turns alternate.
          expect(cubeGrown(s)).toBe(s.moves.length > 7 || (s.moves.length === 7 && !s.result));
          if (!s.result) expect(s.toMove).not.toBe(prev.toMove);
          if (cubeGrown(s) && !cubeGrown(prev))
            prev.cells.forEach((m, c) => {
              if (m) expect(s.cells[CUBE_GROWN[c] as number]).toBe(m);
            });
        }
        endsOnFour(
          CUBE_LINES,
          states.filter((s) => !cubeGrown(s)),
        );
        endsOnFour(CAP_LINES, states.filter(cubeGrown));
      }),
      { numRuns: 200 },
    );
  });

  it("Gravity: every mark rests on the bottom or a mark; the game ends exactly on four or a full board (G1–G3)", () => {
    fc.assert(
      fc.property(picks, (p) => {
        const states = walk<ClassicState>(gravity, p);
        sharedInvariants(gravity, states);
        for (const s of states)
          s.cells.forEach((m, i) => {
            if (m && i + GRAVITY_SIZE < s.cells.length)
              expect(s.cells[i + GRAVITY_SIZE]).not.toBeNull();
          });
        endsOnFour(GRAVITY_LINES, states);
      }),
      { numRuns: 300 },
    );
  });

  it("Vanishing", () => {
    fc.assert(
      fc.property(picks, (p) => {
        const states = walk<VanishingState>(vanishing, p);
        sharedInvariants(vanishing, states);
        for (const s of states) {
          // V1: at most three marks each, never on the same cell.
          expect(s.marks.X.length).toBeLessThanOrEqual(MARKS_PER_SIDE);
          expect(s.marks.O.length).toBeLessThanOrEqual(MARKS_PER_SIDE);
          expect(new Set([...s.marks.X, ...s.marks.O]).size).toBe(
            s.marks.X.length + s.marks.O.length,
          );
          // V5: never longer than the cap.
          expect(s.moves.length).toBeLessThanOrEqual(VANISHING_RULES.maxPlies);
          const r = s.result;
          if (r?.kind === "win") for (const i of r.line) expect(cellsOf(s)[i]).toBe(r.winner);
          if (!r)
            expect(Math.max(...Object.values(s.seen))).toBeLessThan(
              VANISHING_RULES.repetitionLimit,
            );
        }
        // V3: the first move is never on an edge.
        const first = states[1]?.moves[0];
        if (first !== undefined) expect([1, 3, 5, 7]).not.toContain(first);
      }),
      { numRuns: 500 },
    );
  });

  it("Ultimate: each move obeys its target, claims stand, and a win is three claimed boards (U2–U5)", () => {
    fc.assert(
      fc.property(picks, (p) => {
        const states = walk<UltimateState>(ultimate, p);
        sharedInvariants(ultimate, states);
        for (let i = 1; i < states.length; i++) {
          const prev = states[i - 1] as UltimateState;
          const s = states[i] as UltimateState;
          const b = Math.floor((s.moves.at(-1) as number) / 9);
          expect(prev.boards[b]).toBeNull(); // U3: never in a closed board
          if (prev.target !== null) expect(b).toBe(prev.target); // U2
          for (const [j, d] of prev.boards.entries()) if (d) expect(s.boards[j]).toBe(d);
          for (const [j, line] of s.claims.entries())
            if (line) for (const c of line) expect(s.cells[c]).toBe(s.boards[j]);
          if (s.result?.kind === "win") {
            for (const c of s.result.line)
              expect(s.boards[Math.floor(c / 9)]).toBe(s.result.winner);
            expect(s.result.line.map((c) => Math.floor(c / 9))).toContain(b);
          }
        }
        expect((states.at(-1) as UltimateState).moves.length).toBeLessThanOrEqual(81); // R5
      }),
      { numRuns: 300 },
    );
  });

  it("Notakto: only X is placed, dead boards stay dead, and the last kill loses (N1–N4)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), picks, (n, p) => {
        const start = notakto.init("X", n);
        const states = walk<NotaktoState>(notakto, p, start);
        sharedInvariants(notakto, states, start);
        for (let i = 1; i < states.length; i++) {
          const prev = states[i - 1] as NotaktoState;
          const s = states[i] as NotaktoState;
          const cell = s.moves.at(-1) as number;
          expect(s.cells[cell]).toBe("X"); // N1
          expect(prev.dead[Math.floor(cell / 9)]).toBeNull(); // N2: never on a dead board
          for (const [b, d] of prev.dead.entries()) if (d) expect(s.dead[b]).toBe(d);
          if (s.result?.kind === "win") {
            // N3: the mover killed the last live board and lost; N4: no draws.
            expect(s.dead.every((d) => d !== null)).toBe(true);
            expect(s.result.winner).not.toBe(prev.toMove);
            expect(s.result.line).toContain(cell);
          }
          expect(s.result?.kind).not.toBe("draw");
        }
        const last = states[states.length - 1] as NotaktoState;
        if (notakto.legalMoves(last).length === 0) expect(last.result).not.toBeNull();
      }),
      { numRuns: 500 },
    );
  });
});
