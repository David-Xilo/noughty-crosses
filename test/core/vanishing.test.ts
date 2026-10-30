import { describe, expect, it } from "vitest";
import { cellsOf, createVanishing, nextToVanish, vanishing } from "../../src/core/vanishing";

const play = (cells: number[], mode = vanishing) => cells.reduce(mode.apply, mode.init());

describe("Vanishing (GDD §3.2)", () => {
  it("V1/V2: placing a fourth mark removes that side's oldest mark", () => {
    // X: 0, 2, 6 then 8 → X's 0 vanishes. O: 4, 3, 5? avoid lines: O plays 4, 7, 5.
    const s = play([0, 4, 2, 7, 6, 5, 8]);
    expect(s.marks.X).toEqual([2, 6, 8]);
    expect(cellsOf(s)[0]).toBeNull();
  });

  it("V2: the cell of the mark about to vanish cannot be chosen", () => {
    const s = play([0, 4, 2, 7, 6, 5]);
    expect(nextToVanish(s, "X")).toBe(0);
    expect(vanishing.legalMoves(s)).not.toContain(0);
    expect(vanishing.apply(s, 0)).toBe(s);
  });

  it("V2: a line counts only after the oldest mark is removed", () => {
    // X holds 0, 1 and 8 (0 oldest). Playing 2 would complete 0-1-2, but 0 vanishes first.
    const s = play([0, 4, 1, 3, 8, 6]);
    expect(s.result).toBeNull();
    const after = vanishing.apply(s, 2);
    expect(after.marks.X).toEqual([1, 8, 2]);
    expect(after.result).toBeNull();
  });

  it("V3: the first move may not be on an edge cell", () => {
    expect(vanishing.legalMoves(vanishing.init())).toEqual([0, 2, 4, 6, 8]);
    const free = createVanishing({ noEdgeOpening: false, repetitionLimit: 3, maxPlies: 60 });
    expect(free.legalMoves(free.init())).toHaveLength(9);
  });

  it("V4: the third occurrence of a position is a draw", () => {
    // After the setup, X holds [0, 8, 7] and O holds [4, 2, 3], X to move (occurrence 1).
    // Each side re-places on the cell its own last removal freed, so 8 plies return to the
    // same marks, ages and side to move, without making a line.
    let s = play([0, 4, 8, 2, 7, 3]);
    const cycle = [5, 1, 0, 4, 8, 2, 7, 3];
    for (const c of cycle) s = vanishing.apply(s, c);
    expect(s.result).toBeNull();
    expect(s.marks).toEqual({ X: [0, 8, 7], O: [4, 2, 3] }); // occurrence 2
    for (const c of cycle) s = vanishing.apply(s, c);
    expect(s.result).toEqual({ kind: "draw", reason: "repetition" }); // occurrence 3
  });

  it("V5: the game is drawn at the ply cap", () => {
    const capped = createVanishing({ noEdgeOpening: true, repetitionLimit: 1000, maxPlies: 8 });
    const s = play([0, 4, 8, 2, 7, 3, 5, 1], capped);
    expect(s.moves).toHaveLength(8);
    expect(s.result).toEqual({ kind: "draw", reason: "ply-cap" });
  });
});
