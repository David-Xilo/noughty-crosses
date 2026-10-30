// The shipped solution tables match a fresh solve on every reachable position (TTT-3.2).
// If this fails after a rules change, regenerate them with `npm run tables`.
import { describe, expect, it } from "vitest";
import { SOLVED_TABLES } from "../../src/core/solved-tables";
import { solve } from "../../src/core/solver";
import { type AnySolvedTable, type SolvedTable, tableSolution } from "../../src/core/table";
import { shippedTable } from "../support/tables";

function reachable<S>({ mode, starts }: SolvedTable<S>): S[] {
  const seen = new Set<string>();
  const out: S[] = [];
  const queue = [...starts];
  for (const s of queue) {
    if (seen.has(mode.key(s))) continue;
    seen.add(mode.key(s));
    out.push(s);
    if (!mode.result(s)) for (const m of mode.legalMoves(s)) queue.push(mode.apply(s, m));
  }
  return out;
}

function expectSame<S>(t: SolvedTable<S>) {
  const table = shippedTable(t);
  const fresh = solve(t.mode, t.starts);
  const states = reachable(t);
  expect(table.positions).toBe(fresh.positions);
  expect(table.positions).toBe(states.length);
  for (const s of states) {
    const a = table.value(s);
    const b = fresh.value(s);
    if (a.outcome !== b.outcome || a.plies !== b.plies)
      expect({ key: t.mode.key(s), ...a }).toEqual({ key: t.mode.key(s), ...b });
  }
}

describe("solution tables", () => {
  // Vanishing's takes about 3 s to check, so it is left out (TTT-0.3, P12).
  for (const t of Object.values(SOLVED_TABLES) as AnySolvedTable[])
    if (t.id !== "vanishing")
      it(`${t.id}: the table equals the solver from every start`, () => expectSame(t));
  it("a table of the wrong length is refused at load", () => {
    const [t] = Object.values(SOLVED_TABLES) as AnySolvedTable[];
    if (!t) throw new Error("no tables");
    expect(() => tableSolution(t, new Uint8Array(t.ranks - 1))).toThrow(/bytes, not/);
  });
});
