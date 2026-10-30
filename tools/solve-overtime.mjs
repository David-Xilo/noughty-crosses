// TTT-4.1.11: the offline solve of Overtime. Every Classic game that ends in a draw (both
// starting sides) is placed in the centre of a 5×5 board, and the 16 ring cells are solved
// with four in a row (GDD §3.8). Then Classic's 3×3 phase is solved with those results as
// its draws. Prints JSON: each draw's result, and the whole game's from the start.
// Usage: node tools/solve-overtime.mjs
// Lines and the centre come from the rules core; the ring solve is a full minimax with a
// position memo on bitboards, so it reports exact results and plies (fastest win, slowest
// loss). About 35 s and 2 GB on this computer.
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true, watch: null },
  appType: "custom",
  logLevel: "silent",
});
const load = (p) => server.ssrLoadModule(p);
const { classic } = await load("/src/core/classic.ts");
const { BIG_LINES } = await load("/src/core/bigboard.ts");
const { OVERTIME_CENTRE, overtime } = await load("/src/core/overtime.ts");
const { solve } = await load("/src/core/solver.ts");
const { createRng } = await load("/src/core/rng.ts");
await server.close();

const N = 25;
const FULL = 2 ** N - 1;
const lineMasks = BIG_LINES.map((l) => l.reduce((m, c) => m | (1 << c), 0));
const linesThrough = Array.from({ length: N }, (_, c) => lineMasks.filter((m) => m & (1 << c)));

// The ring's 16 cells; a position of one start is its ring in base 3 (1 X, 2 O), so the
// memo is one byte per position: 3^16, about 43M (TTT-1.3).
const RING = Array.from({ length: N }, (_, c) => c).filter((c) => !OVERTIME_CENTRE.includes(c));
const pow3 = new Map(RING.map((c, i) => [c, 3 ** i]));
const UNKNOWN = -128;
const memo = new Int8Array(3 ** RING.length);
let positions = 0;

// Value from the mover's side: 100 - plies for a win, -(100 - plies) for a loss, 0 a draw.
function value(me, them, rank, digit) {
  const hit = memo[rank];
  if (hit !== UNKNOWN) return hit;
  positions++;
  const empty = FULL & ~(me | them);
  let best = -100;
  for (const c of RING) {
    const bit = 1 << c;
    if (!(empty & bit)) continue;
    const mine = me | bit;
    let v;
    if (linesThrough[c].some((m) => (mine & m) === m)) v = 99;
    else if ((mine | them) === FULL) v = 0;
    else {
      const w = -value(them, mine, rank + digit * pow3.get(c), 3 - digit);
      v = w > 0 ? w - 1 : w < 0 ? w + 1 : 0;
    }
    if (v > best) best = v;
    if (best === 99) break;
  }
  memo[rank] = best;
  return best;
}

// Every Classic draw from both starts, with its ply-9 board.
const draws = new Map();
const walk = (s) => {
  const r = classic.result(s);
  if (r) {
    if (r.kind === "draw") draws.set(classic.key(s), s);
    return;
  }
  for (const m of classic.legalMoves(s)) walk(classic.apply(s, m));
};
walk(classic.init("X"));
walk(classic.init("O"));

const describe = (v, mover) =>
  v === 0
    ? { outcome: "draw" }
    : { outcome: v > 0 ? mover : mover === "X" ? "O" : "X", plies: 100 - Math.abs(v) };

// The rules core's own solver agrees on part-filled rings: from each draw that X started,
// seeded random ring moves (8 to 11, no line yet), then both solve the rest.
const rng = createRng(4111);
const agree = { checked: 0, X: 0, O: 0, draw: 0 };
function crossCheck(drawn) {
  const counted = positions;
  for (let trial = 0; trial < 12; trial++) {
    // Replay the draw through the rules core so the board grows (O2); the side that made
    // the ninth mark started.
    let s = overtime.init(drawn.toMove);
    for (const m of drawn.moves) s = overtime.apply(s, m);
    const fill = 8 + rng.int(4);
    for (let i = 0; i < fill && !s.result; i++) {
      const legal = overtime.legalMoves(s);
      const next = overtime.apply(s, legal[rng.int(legal.length)]);
      if (next.result) break;
      s = next;
    }
    if (s.result) continue;
    let x = 0;
    let o = 0;
    let rank = 0;
    s.cells.forEach((m, c) => {
      if (m === "X") x |= 1 << c;
      if (m === "O") o |= 1 << c;
      if (m && pow3.has(c)) rank += pow3.get(c) * (m === "X" ? 1 : 2);
    });
    const ours = describe(
      s.toMove === "X" ? value(x, o, rank, 1) : value(o, x, rank, 2),
      s.toMove,
    ).outcome;
    const theirs = solve(overtime, s).value(s).outcome;
    if (ours !== theirs) throw new Error(`cross-check differs: ${overtime.key(s)}`);
    agree.checked++;
    agree[ours]++;
  }
  positions = counted; // report the draws' rings only
}

let ringMs = 0;
const ring = new Map();
for (const [key, s] of draws) {
  const t = performance.now();
  // The side that made the ninth mark has moved; the other side opens the ring (O1, O3).
  const mover = s.toMove === "X" ? "O" : "X";
  let x = 0;
  let o = 0;
  s.cells.forEach((m, i) => {
    const bit = 1 << (OVERTIME_CENTRE[i] ?? -1);
    if (m === "X") x |= bit;
    if (m === "O") o |= bit;
  });
  memo.fill(UNKNOWN);
  const v = mover === "X" ? value(x, o, 0, 1) : value(o, x, 0, 2);
  // Lines of four still open to a side: none of the other side's marks on them.
  const open = (other) => lineMasks.filter((m) => !(m & other)).length;
  ring.set(key, {
    board: key.slice(0, 9),
    started: s.toMove,
    ...describe(v, mover),
    openLines: { X: open(o), O: open(x) },
  });
  ringMs += performance.now() - t;
  if (s.toMove === "X") crossCheck(s);
}

// The 3×3 phase: Classic, except that a draw takes the ring's value.
const score = new Map(); // key → value from X's side: +1 X wins, 0 draw, -1 O wins
const solve3 = (s) => {
  const key = classic.key(s);
  if (score.has(key)) return score.get(key);
  const r = classic.result(s);
  let v;
  if (r?.kind === "win") v = r.winner === "X" ? 1 : -1;
  else if (r) {
    const o = ring.get(key).outcome;
    v = o === "draw" ? 0 : o === "X" ? 1 : -1;
  } else {
    const kids = classic.legalMoves(s).map((m) => solve3(classic.apply(s, m)));
    v = s.toMove === "X" ? Math.max(...kids) : Math.min(...kids);
  }
  score.set(key, v);
  return v;
};
const name = (v) => (v === 0 ? "draw" : v > 0 ? "X" : "O");
const start = {};
for (const first of ["X", "O"]) {
  const s = classic.init(first);
  start[`${first} starts`] = {
    outcome: name(solve3(s)),
    firstMoves: Object.fromEntries(
      classic.legalMoves(s).map((m) => [m, name(solve3(classic.apply(s, m)))]),
    ),
  };
}

const rows = [...ring.values()];
const tally = (first) => {
  const of = rows.filter((r) => r.started === first);
  return {
    draws: of.length,
    X: of.filter((r) => r.outcome === "X").length,
    O: of.filter((r) => r.outcome === "O").length,
    drawn: of.filter((r) => r.outcome === "draw").length,
    longestWin: Math.max(0, ...of.filter((r) => r.outcome !== "draw").map((r) => r.plies)),
    openLines: [
      Math.min(...of.map((r) => r.openLines.X + r.openLines.O)),
      Math.max(...of.map((r) => r.openLines.X + r.openLines.O)),
    ],
  };
};
console.log(
  JSON.stringify(
    {
      ringPositions: positions,
      ringMs: Math.round(ringMs),
      crossCheck: agree,
      byStart: { X: tally("X"), O: tally("O") },
      start,
      draws: rows,
    },
    null,
    2,
  ),
);
