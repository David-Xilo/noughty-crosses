import { describe, expect, it } from "vitest";
import { createRng } from "../../src/core/rng";
import type { Side } from "../../src/core/types";
import { type BoardState, fairStart, type UltimateState, ultimate } from "../../src/core/ultimate";

// Cells are board-major: board b's cell i is b * 9 + i.
const play = (cells: number[], start = ultimate.init()) =>
  cells.reduce((s, c) => {
    const next = ultimate.apply(s, c);
    if (next === s) throw new Error(`move ${c} refused`);
    return next;
  }, start);
// X claims board 0 with its top row on move 11; O is then sent to board 2.
const CLAIM = [40, 36, 0, 4, 37, 9, 1, 13, 38, 18, 2];

/** A hand-set position: `boards` decided, `marks` placed, `toMove` sent to `target`. */
function position(
  boards: BoardState[],
  marks: Record<number, Side>,
  toMove: Side,
  target: number | null,
): UltimateState {
  const cells = Array(81).fill(null);
  for (const [c, m] of Object.entries(marks)) cells[Number(c)] = m;
  return { ...ultimate.init(toMove), cells, boards, target };
}

describe("Ultimate (GDD §3.6)", () => {
  it("U1, U2: nine boards of nine cells; a move sends the opponent to the board in the same place", () => {
    expect(ultimate.legalMoves(ultimate.init())).toHaveLength(81);
    const s = play([40]); // board 4, its centre
    expect(s.target).toBe(4);
    expect(ultimate.legalMoves(s)).toEqual([36, 37, 38, 39, 41, 42, 43, 44]);
    expect(ultimate.apply(s, 0)).toBe(s); // R2: outside the target board
    expect(ultimate.apply(s, 40)).toBe(s); // a taken cell
    const t = play([40, 36]); // board 4, cell 0: X goes to board 0
    expect(t.target).toBe(0);
    expect(ultimate.legalMoves(t).every((c) => c < 9)).toBe(true);
  });

  it("U4: three in a row claims a board, which then takes no more marks", () => {
    const s = play(CLAIM);
    expect(s.boards[0]).toBe("X");
    expect(s.claims[0]).toEqual([0, 1, 2]);
    expect(s.result).toBeNull();
    expect(s.target).toBe(2);
  });

  it("U3: sent to a claimed board, the side to move may play in any open board", () => {
    const s = play([...CLAIM, 20, 21, 27]); // O plays board 3's cell 0: X is sent to board 0
    expect(s.toMove).toBe("X");
    expect(s.target).toBeNull();
    const legal = ultimate.legalMoves(s);
    expect(legal.some((c) => c < 9)).toBe(false);
    expect(legal).toContain(10);
    expect(legal).toContain(80);
    expect(ultimate.apply(s, 3)).toBe(s); // the claimed board refuses
  });

  it("U4: a full board without a line is dead and counts for nobody", () => {
    // Board 0: X O X / X O O / O X _; X fills cell 8 without a line.
    const s = position(
      Array(9).fill(null),
      { 0: "X", 1: "O", 2: "X", 3: "X", 4: "O", 5: "O", 6: "O", 7: "X" },
      "X",
      0,
    );
    const t = ultimate.apply(s, 8);
    expect(t.boards[0]).toBe("dead");
    expect(t.claims[0]).toBeNull();
    expect(t.target).toBe(8); // cell 8 sends O to board 8
  });

  it("U5: three claimed boards in a row win; the line is the boards' centre cells", () => {
    const s = position(
      ["X", "X", null, null, null, null, null, null, null],
      { 18: "X", 19: "X" },
      "X",
      2,
    );
    const t = ultimate.apply(s, 20);
    expect(t.result).toEqual({ kind: "win", winner: "X", line: [4, 13, 22] });
    expect(ultimate.legalMoves(t)).toEqual([]);
  });

  it("U5: the game is drawn once neither side can still claim a line of three boards", () => {
    // X's only line left is the diagonal through board 8; O blocks board 8's last free lines.
    const boards: BoardState[] = ["X", "O", "O", "O", "X", "X", "X", "O", null];
    const s = position(boards, { 73: "O", 75: "O", 76: "O" }, "O", 8);
    expect(ultimate.legalMoves(s).length).toBeGreaterThan(0);
    const t = ultimate.apply(s, 80);
    expect(t.boards[8]).toBeNull(); // still open, but nobody can use it
    expect(t.result).toEqual({ kind: "draw", reason: "no-line" });
  });

  it("U6: a fair start plays four random legal moves from the game's generator", () => {
    const a = fairStart(ultimate.init("O"), createRng(7));
    expect(a.moves).toHaveLength(4);
    expect(a.toMove).toBe("O");
    expect(play(a.moves as number[], ultimate.init("O"))).toEqual(a);
    expect(fairStart(ultimate.init("O"), createRng(7))).toEqual(a);
    const openings = new Set(
      Array.from({ length: 20 }, (_, i) => fairStart(ultimate.init(), createRng(i)).moves.join()),
    );
    expect(openings.size).toBe(20);
  });
});
