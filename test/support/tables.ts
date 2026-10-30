// The shipped solution tables (public/assets/*_table.bin), loaded as the game loads them.
import fs from "node:fs";
import path from "node:path";
import { type SolvedTable, tableSolution } from "../../src/core/table";

export const shippedTable = <S>(t: SolvedTable<S>) =>
  tableSolution(
    t,
    new Uint8Array(
      fs.readFileSync(path.resolve(__dirname, `../../public/assets/${t.id}_table.bin`)),
    ),
  );
