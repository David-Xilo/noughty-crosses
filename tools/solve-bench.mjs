// TTT-3.2: times the Vanishing solve inside a Web Worker in Chromium (1× and 4× CPU
// throttle), to compare with the shipped table (npm run table). Playwright's WebKit does not
// start on this computer (libicudata.so.74 missing), so WebKit is not measured.
// Usage: node tools/solve-bench.mjs
import { chromium } from "@playwright/test";
import { build } from "vite";

// Bundle a worker that solves Vanishing from both starts and posts the time.
const entry = "\0solve-bench-worker";
const out = await build({
  configFile: false,
  logLevel: "silent",
  plugins: [
    {
      name: "entry",
      resolveId: (id) => (id === entry ? id : null),
      load: (id) =>
        id === entry
          ? `import { solve } from "/src/core/solver.ts";
             import { createVanishing } from "/src/core/vanishing.ts";
             const pure = createVanishing({ noEdgeOpening: true,
               repetitionLimit: Infinity, maxPlies: Infinity });
             const t = performance.now();
             const s = solve(pure, [pure.init("X"), pure.init("O")]);
             postMessage({ ms: performance.now() - t, positions: s.positions });`
          : null,
    },
  ],
  build: {
    write: false,
    rollupOptions: { input: entry, output: { format: "iife" } },
  },
});
const code = [out].flat()[0].output[0].code;

const runs = [];
for (const throttle of [1, 4]) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  if (throttle > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  await page.setContent("<p>bench</p>");
  for (let i = 0; i < 3; i++) {
    const r = await page.evaluate(
      (src) =>
        new Promise((ok) => {
          const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
          w.onmessage = (e) => ok(e.data);
        }),
      code,
    );
    runs.push({ cpuThrottle: throttle, run: i + 1, ...r, ms: Math.round(r.ms) });
  }
  await browser.close();
}
console.table(runs);
