// Monte Carlo tree search (UCT) for Ultimate (GDD §4.1): random playouts on a fast, mutable
// copy of the rules (bit masks per board), which must agree with src/core/ultimate.ts move
// for move (test/core/ultimate.test.ts). The budget is a playout count, not a clock, so a
// seed gives the same move on every device (R6).
import { type Level, type Player, winningMoves } from "./players";
import type { Rng } from "./rng";
import { LINES_3x3 } from "./types";
import { type UltimateState, ultimate } from "./ultimate";

/**
 * Playouts per move (GDD §4.1): Casual 100, Keen 1,000, Sharp sized to the time budget
 * (research TTT-4.1.5).
 */
const PLAYOUTS: Record<Level, number> = { casual: 100, keen: 1_000, sharp: 5_000 };

/** The UCT exploration constant, for rewards from 0 to 1. */
const EXPLORE = Math.SQRT2;

const LINE_MASKS = LINES_3x3.map((l) => l.reduce((m, i) => m | (1 << i), 0));
/** Per 9-bit mask: whether it holds a line of three. */
const WIN = Uint8Array.from({ length: 512 }, (_, m) =>
  LINE_MASKS.some((l) => (m & l) === l) ? 1 : 0,
);
/** Per 9-bit mask of one side's marks: whether a line still holds none of them. */
const FREE = Uint8Array.from({ length: 512 }, (_, m) =>
  LINE_MASKS.some((l) => (m & l) === 0) ? 1 : 0,
);
const POP = Uint8Array.from({ length: 512 }, (_, m) => {
  let c = 0;
  for (let x = m; x; x &= x - 1) c++;
  return c;
});

/** The `k`-th set bit (from 0) of a 9-bit mask. */
function nthBit(mask: number, k: number): number {
  let m = mask;
  for (let j = 0; j < k; j++) m &= m - 1;
  return 31 - Math.clz32(m & -m);
}

const OPEN = 0;
const DEAD = 3;
/** `result` values: none yet, X won, O won, a draw. */
const PLAYING = 0;
const DRAW = 3;

/** A mutable Ultimate position; sides are 1 (X) and 2 (O). */
class FastGame {
  readonly x = new Int16Array(9);
  readonly o = new Int16Array(9);
  /** Per board: OPEN, 1 or 2 (claimed), or DEAD. */
  readonly status = new Int8Array(9);
  claimedX = 0;
  claimedO = 0;
  /** The board the side to move is sent to, or -1 for any open board. */
  target = -1;
  toMove = 1;
  result = PLAYING;

  static from(s: UltimateState): FastGame {
    const g = new FastGame();
    s.cells.forEach((m, c) => {
      const b = Math.floor(c / 9);
      if (m === "X") g.x[b] = (g.x[b] as number) | (1 << (c - b * 9));
      if (m === "O") g.o[b] = (g.o[b] as number) | (1 << (c - b * 9));
    });
    s.boards.forEach((st, b) => {
      g.status[b] = st === null ? OPEN : st === "X" ? 1 : st === "O" ? 2 : DEAD;
      if (st === "X") g.claimedX |= 1 << b;
      if (st === "O") g.claimedO |= 1 << b;
    });
    g.target = s.target ?? -1;
    g.toMove = s.toMove === "X" ? 1 : 2;
    const r = s.result;
    g.result = !r ? PLAYING : r.kind === "draw" ? DRAW : r.winner === "X" ? 1 : 2;
    return g;
  }

  copyFrom(g: FastGame): void {
    this.x.set(g.x);
    this.o.set(g.o);
    this.status.set(g.status);
    this.claimedX = g.claimedX;
    this.claimedO = g.claimedO;
    this.target = g.target;
    this.toMove = g.toMove;
    this.result = g.result;
  }

  /** Plays a legal move (unchecked); see ultimate.apply for the rules. */
  play(cell: number): void {
    const b = (cell / 9) | 0;
    const i = cell - b * 9;
    const p = this.toMove;
    const mine = p === 1 ? this.x : this.o;
    const m = (mine[b] as number) | (1 << i);
    mine[b] = m;
    if (WIN[m]) {
      this.status[b] = p;
      if (p === 1) this.claimedX |= 1 << b;
      else this.claimedO |= 1 << b;
      if (WIN[p === 1 ? this.claimedX : this.claimedO]) {
        this.result = p;
        this.target = -1;
        return;
      }
    } else if ((m | ((p === 1 ? this.o[b] : this.x[b]) as number)) === 511) {
      this.status[b] = DEAD;
    }
    // U5: a draw when neither side can still claim a line of three boards.
    let canX = this.claimedX;
    let canO = this.claimedO;
    for (let j = 0; j < 9; j++) {
      if (this.status[j] !== OPEN) continue;
      if (FREE[this.o[j] as number]) canX |= 1 << j;
      if (FREE[this.x[j] as number]) canO |= 1 << j;
    }
    if (!WIN[canX] && !WIN[canO]) {
      this.result = DRAW;
      this.target = -1;
      return;
    }
    this.target = this.status[i] === OPEN ? i : -1;
    this.toMove = 3 - p;
  }

  /** The empty cells of board `b` as a mask (0 when it is closed). */
  private empties(b: number): number {
    return this.status[b] === OPEN ? 511 & ~((this.x[b] as number) | (this.o[b] as number)) : 0;
  }

  legalMoves(): number[] {
    const moves: number[] = [];
    if (this.result !== PLAYING) return moves;
    for (let b = 0; b < 9; b++) {
      if (this.target >= 0 && b !== this.target) continue;
      for (let e = this.empties(b); e; e &= e - 1) moves.push(b * 9 + 31 - Math.clz32(e & -e));
    }
    return moves;
  }

  /** A uniformly random legal move. */
  randomMove(rng: Rng): number {
    if (this.target >= 0) {
      const e = this.empties(this.target);
      return this.target * 9 + nthBit(e, rng.int(POP[e] as number));
    }
    let total = 0;
    for (let b = 0; b < 9; b++) total += POP[this.empties(b)] as number;
    let k = rng.int(total);
    for (let b = 0; ; b++) {
      const e = this.empties(b);
      const n = POP[e] as number;
      if (k < n) return b * 9 + nthBit(e, k);
      k -= n;
    }
  }
}

interface Node {
  readonly move: number;
  /** The side that played `move`: rewards are counted for it. */
  readonly mover: number;
  readonly parent: Node | null;
  readonly children: Node[];
  /** Legal moves not yet expanded into children. */
  readonly untried: number[];
  visits: number;
  score: number;
}

/**
 * Runs `playouts` iterations of UCT from `root` and returns the root's children, the most
 * visited first.
 */
function searchTree(root: FastGame, playouts: number, rng: Rng): Node[] {
  const top: Node = {
    move: -1,
    mover: 3 - root.toMove,
    parent: null,
    children: [],
    untried: root.legalMoves(),
    visits: 0,
    score: 0,
  };
  const g = new FastGame();
  for (let n = 0; n < playouts; n++) {
    g.copyFrom(root);
    let node = top;
    // Selection: the child with the best upper confidence bound, while all are expanded.
    while (node.untried.length === 0 && node.children.length > 0) {
      const log = Math.log(node.visits);
      let best = node.children[0] as Node;
      let bestValue = -1;
      for (const c of node.children) {
        const v = c.score / c.visits + EXPLORE * Math.sqrt(log / c.visits);
        if (v > bestValue) {
          bestValue = v;
          best = c;
        }
      }
      node = best;
      g.play(node.move);
    }
    // Expansion: one untried move, chosen by the generator.
    if (node.untried.length > 0) {
      const k = rng.int(node.untried.length);
      const move = node.untried[k] as number;
      node.untried[k] = node.untried[node.untried.length - 1] as number;
      node.untried.pop();
      const mover = g.toMove;
      g.play(move);
      const child: Node = {
        move,
        mover,
        parent: node,
        children: [],
        untried: g.legalMoves(),
        visits: 0,
        score: 0,
      };
      node.children.push(child);
      node = child;
    }
    // Playout: random moves to the end.
    while (g.result === PLAYING) g.play(g.randomMove(rng));
    // Back-propagation: a win counts 1 for the side that made the node's move, a draw 0.5.
    for (let at: Node | null = node; at; at = at.parent) {
      at.visits++;
      at.score += g.result === DRAW ? 0.5 : g.result === at.mover ? 1 : 0;
    }
  }
  return [...top.children].sort((a, b) => b.visits - a.visits || b.score - a.score);
}

/** Moves after which the side to move has claimed a board. */
function claiming(root: FastGame): number[] {
  const g = new FastGame();
  const p = root.toMove;
  return root.legalMoves().filter((c) => {
    g.copyFrom(root);
    g.play(c);
    return g.status[(c / 9) | 0] === p;
  });
}

/**
 * The computer at `level` (GDD §4.1, Ultimate). Every level takes a game win on the board.
 * Casual otherwise prefers to claim a board now, when it can; Keen and Sharp play the most
 * visited move.
 */
export const ultimatePlayer =
  (level: Level, rng: Rng): Player<UltimateState> =>
  (s) => {
    const root = FastGame.from(s);
    const legal = root.legalMoves();
    if (legal.length === 1) return legal[0] as number;
    const wins = winningMoves(ultimate, s);
    if (wins.length > 0) return wins[rng.int(wins.length)] as number;
    const ranked = searchTree(root, PLAYOUTS[level], rng);
    if (level === "casual") {
      const claims = claiming(root);
      const claim = ranked.find((n) => claims.includes(n.move));
      if (claim) return claim.move;
    }
    return (ranked[0] as Node).move;
  };
