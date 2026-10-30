// Writes the solved tables listed in src/core/solved-tables.ts to public/assets/*_table.bin
// and reports their sizes and the solve and decode times. Usage: npm run tables
// The tables are data made by our own solver from the rules core; `npm run check` verifies
// that they match a fresh solve.
import fs from "node:fs";
import zlib from "node:zlib";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const load = (p) => server.ssrLoadModule(p);
const { SOLVED_TABLES } = await load("/src/core/solved-tables.ts");
const { solve } = await load("/src/core/solver.ts");
const { encodeTable, tableSolution } = await load("/src/core/table.ts");

const report = [];
for (const t of Object.values(SOLVED_TABLES)) {
  let ms = performance.now();
  const solution = solve(t.mode, t.starts);
  const solveMs = performance.now() - ms;
  const table = encodeTable(t, solution.value);

  const file = `public/assets/${t.id}_table.bin`;
  fs.writeFileSync(file, table);
  ms = performance.now();
  const decoded = tableSolution(t, new Uint8Array(fs.readFileSync(file)));
  const decodeMs = performance.now() - ms;
  if (decoded.positions !== solution.positions) throw new Error(`${t.id}: position count differs`);
  report.push({
    file,
    positions: decoded.positions,
    longestForcedWin: decoded.longestForcedWin,
    rawBytes: table.length,
    gzipBytes: zlib.gzipSync(table, { level: 9 }).length,
    solveMs: Math.round(solveMs),
    decodeMs: +decodeMs.toFixed(1),
  });
}
console.log(JSON.stringify(report, null, 2));
await server.close();
