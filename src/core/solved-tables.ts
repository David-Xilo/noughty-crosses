// The small solved modes (R9): their solutions ship as tables in public/assets/. One list
// for `npm run tables`, which writes them, src/app/modes.ts, which loads them, and
// test/core/tables.test.ts, which checks them against a fresh solve.
import { CLASSIC_RANKS, classic, classicRank } from "./classic";
import { misere } from "./misere";
import { misereWild } from "./misere-wild";
import { pureMorris } from "./morris";
import { NOTAKTO_RANKS, notakto, notaktoRank } from "./notakto";
import { SAUCER_RANKS, saucer, saucerRank } from "./saucer";
import type { SolvedTable } from "./table";
import type { Mode } from "./types";
import { pureVanishing, VANISHING_RANKS, vanishingRank } from "./vanishing";

const sides = <S>(mode: Mode<S>) => [mode.init("X"), mode.init("O")];
const table = <S>(t: SolvedTable<S>) => t;

export const SOLVED_TABLES = {
  classic: table({
    id: "classic",
    mode: classic,
    rank: classicRank,
    ranks: CLASSIC_RANKS,
    starts: sides(classic),
  }),
  vanishing: table({
    id: "vanishing",
    mode: pureVanishing,
    rank: vanishingRank,
    ranks: VANISHING_RANKS,
    starts: sides(pureVanishing),
  }),
  misere: table({
    id: "misere",
    mode: misere,
    rank: classicRank,
    ranks: CLASSIC_RANKS,
    starts: sides(misere),
  }),
  "misere-wild": table({
    id: "misere-wild",
    mode: misereWild,
    rank: classicRank,
    ranks: CLASSIC_RANKS,
    starts: sides(misereWild),
  }),
  // Morris without its history endings: its board alone fixes the position (TM5).
  morris: table({
    id: "morris",
    mode: pureMorris,
    rank: classicRank,
    ranks: CLASSIC_RANKS,
    starts: sides(pureMorris),
  }),
  // Saucer: the board, the side to move and the saucer's rhythm (S5).
  saucer: table({
    id: "saucer",
    mode: saucer,
    rank: saucerRank,
    ranks: SAUCER_RANKS,
    starts: sides(saucer),
  }),
  // One table for one to three boards: positions are the live boards up to symmetry.
  notakto: table({
    id: "notakto",
    mode: notakto,
    rank: notaktoRank,
    ranks: NOTAKTO_RANKS,
    starts: [1, 2, 3].flatMap((n) => [notakto.init("X", n), notakto.init("O", n)]),
  }),
};
