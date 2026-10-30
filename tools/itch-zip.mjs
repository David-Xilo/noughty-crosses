// The web build zipped for itch.io (TTT-5.1; root distribution guideline): index.html at the
// root of the ZIP, at most 1,000 files, relative paths. Run after `vite build`:
// `npm run itch` writes export/noughty-crosses-web-<version>.zip and prints the counts.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!existsSync(join(dist, "index.html")))
  throw new Error("dist/index.html: run `vite build` first");

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(dist, p));
  }
};
walk(dist);
if (files.length > 1000) throw new Error(`${files.length} files; itch.io allows 1,000`);
const index = readFileSync(join(dist, "index.html"), "utf8");
const absolute = index.match(/(?:src|href)="\/[^/]/g);
if (absolute) throw new Error(`absolute paths in index.html: ${absolute.join(", ")}`);
if (index.includes("VITE_PLAYTEST") || files.some((f) => f.includes("playtest")))
  throw new Error("a playtest build must not ship");

const out = join(root, "export");
mkdirSync(out, { recursive: true });
const zip = join(out, `noughty-crosses-web-${version}.zip`);
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", "-X", zip, "."], { cwd: dist });
const bytes = statSync(zip).size;
const total = files.reduce((n, f) => n + statSync(join(dist, f)).size, 0);
console.log(
  `${relative(root, zip)}: ${files.length} files, ${(total / 1048576).toFixed(1)} MiB unpacked, ${(bytes / 1048576).toFixed(1)} MiB zipped; index.html at the root`,
);
