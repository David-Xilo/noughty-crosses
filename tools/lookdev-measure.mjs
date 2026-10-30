// Look and budget measurements (TTT-2.3, scenes from TTT-3.2): serve dist/ with gzip, then
// screenshots of the title, the drawers and fixed game scenes (high, low, 2D), orbit frame times,
// draw calls, transfer sizes, and load times on a throttled "Fast 3G" link.
// Usage: npm run build && npm run lookdev:measure
// Output: docs/lookdev/*.png (screenshots) and a JSON report on stdout.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { chromium } from "@playwright/test";

const ROOT = path.resolve("dist");
const OUT = path.resolve("docs/lookdev");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".hdr": "application/octet-stream",
  ".bin": "application/octet-stream",
};

// Gzip-9 every file once and report its transferred size.
const gz = new Map();
for (const f of fs.readdirSync(ROOT, { recursive: true })) {
  const file = path.join(ROOT, String(f));
  if (fs.statSync(file).isFile()) gz.set(file, zlib.gzipSync(fs.readFileSync(file), { level: 9 }));
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  const body = gz.get(file);
  if (!body) return res.writeHead(404).end();
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "Content-Encoding": "gzip",
    "Content-Length": body.length,
  });
  res.end(body);
});
await new Promise((ok) => server.listen(8731, ok));
const base = "http://localhost:8731/";

const browser = await chromium.launch({
  args: [
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--use-angle=vulkan",
    "--enable-features=Vulkan",
  ],
});
fs.mkdirSync(OUT, { recursive: true });
const report = { sizes: {}, runs: [] };

const sum = (a) => a.reduce((x, y) => x + y, 0);
const pct = (a, p) =>
  [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

// Scenes (src/main.ts): the worst case for draw calls is Vanishing mid-game, with both
// fading marks and the cursor's ghost; a won Classic game shows the win line; Notakto
// mid-game has three boards; the full Gravity board stands upright; Ultimate's busiest
// position has the most triangles.
const desktop = { width: 1280, height: 800 };
const phone = { width: 412, height: 915 };
const views = [
  { name: "desktop-title", gfx: "high", viewport: desktop, mobile: false, measure: false },
  // The open cabinet, a drawer per mode (TTT-4.1.6).
  {
    name: "desktop-drawers",
    gfx: "high",
    viewport: desktop,
    mobile: false,
    measure: false,
    drawers: true,
  },
  { name: "phone-drawers", gfx: "2d", viewport: phone, mobile: true, drawers: true },
  { name: "desktop-high", gfx: "high", scene: "vanishing-mid", viewport: desktop, mobile: false },
  { name: "desktop-won", gfx: "high", scene: "classic-won", viewport: desktop, mobile: false },
  { name: "desktop-low", gfx: "low", scene: "vanishing-mid", viewport: desktop, mobile: false },
  {
    name: "phone-low",
    gfx: "low",
    scene: "vanishing-mid",
    viewport: phone,
    mobile: true,
    cpuThrottle: 4,
  },
  { name: "phone-2d", gfx: "2d", scene: "vanishing-mid", viewport: phone, mobile: true },
  // Notakto (TTT-4.1.2): three boards, the most pieces and the widest layout.
  { name: "desktop-notakto", gfx: "high", scene: "notakto-mid", viewport: desktop, mobile: false },
  { name: "desktop-notakto-2d", gfx: "2d", scene: "notakto-mid", viewport: desktop, mobile: false },
  { name: "phone-notakto-2d", gfx: "2d", scene: "notakto-mid", viewport: phone, mobile: true },
  // Big board (TTT-4.1.3): a full 5 by 5 board, the most triangles.
  {
    name: "desktop-bigboard",
    gfx: "high",
    scene: "bigboard-full",
    viewport: desktop,
    mobile: false,
  },
  { name: "phone-bigboard-low", gfx: "low", scene: "bigboard-full", viewport: phone, mobile: true },
  { name: "phone-bigboard-2d", gfx: "2d", scene: "bigboard-full", viewport: phone, mobile: true },
  // Gravity (TTT-4.1.4): a full 6 by 6 upright board, the most pieces and triangles.
  { name: "desktop-gravity", gfx: "high", scene: "gravity-full", viewport: desktop, mobile: false },
  { name: "phone-gravity-low", gfx: "low", scene: "gravity-full", viewport: phone, mobile: true },
  { name: "phone-gravity-2d", gfx: "2d", scene: "gravity-full", viewport: phone, mobile: true },
  // Ultimate (TTT-4.1.5): nine boards, its busiest position: the most triangles.
  {
    name: "desktop-ultimate",
    gfx: "high",
    scene: "ultimate-busy",
    viewport: desktop,
    mobile: false,
  },
  {
    name: "desktop-ultimate-2d",
    gfx: "2d",
    scene: "ultimate-busy",
    viewport: desktop,
    mobile: false,
  },
  { name: "phone-ultimate-low", gfx: "low", scene: "ultimate-busy", viewport: phone, mobile: true },
  { name: "phone-ultimate-2d", gfx: "2d", scene: "ultimate-busy", viewport: phone, mobile: true },
  // Cube (TTT-4.1.12): the grown 5×5×5 cube in the busiest game seen in simulations.
  { name: "desktop-cube", gfx: "high", scene: "cube-busy", viewport: desktop, mobile: false },
  { name: "desktop-cube-2d", gfx: "2d", scene: "cube-busy", viewport: desktop, mobile: false },
  { name: "phone-cube-low", gfx: "low", scene: "cube-busy", viewport: phone, mobile: true },
  { name: "phone-cube-2d", gfx: "2d", scene: "cube-busy", viewport: phone, mobile: true },
  // The pitch's load claim: playable within 1 s on Fast 3G (the TTT-1.5 spike's profile:
  // 1.6 Mbps down, 750 kbps up, 150 ms latency, cold cache).
  { name: "fast3g-high", gfx: "high", viewport: desktop, mobile: false, fast3g: true },
];
const only = process.env.VIEWS?.split(",");
for (const v of views.filter((x) => !only || only.includes(x.name))) {
  const context = await browser.newContext({
    viewport: v.viewport,
    deviceScaleFactor: v.mobile ? 2.625 : 1,
    isMobile: v.mobile,
    hasTouch: v.mobile,
  });
  const page = await context.newPage();
  let bytes = 0;
  page.on("response", async (r) => {
    bytes += Number((await r.allHeaders())["content-length"] ?? 0);
  });
  if (v.fast3g) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
    });
  }
  // On Fast 3G, act as soon as the page responds, like a player; do not wait for "load".
  await page.goto(`${base}?gfx=${v.gfx}${v.scene ? `&scene=${v.scene}` : ""}`, {
    waitUntil: v.fast3g ? "commit" : "load",
  });
  let boardPlayableMs;
  if (v.fast3g) {
    // Through the title, a drawer and the setup card as soon as they work; the flat board
    // stands in until the 3D table arrives, so the first move can be made at once. The title
    // is in the HTML, so wait until the script has wired its menu.
    await page.waitForFunction(() => window.__lookdev?.titleReadyMs !== undefined, null, {
      timeout: 60000,
    });
    // A cold start opens the welcome first (GDD §6); its defaults are kept.
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "Classic", exact: true }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("gridcell").first().waitFor({ state: "visible" });
    await page.getByRole("gridcell").first().click();
    await page.locator('.cell[data-mark="X"]').first().waitFor();
    boardPlayableMs = Math.round(await page.evaluate(() => performance.now()));
  }
  await page.waitForFunction(() => window.__lookdev?.ready === true, null, { timeout: 60000 });
  const times = await page.evaluate(() => ({
    titleInteractiveMs: Math.round(window.__lookdev.titleReadyMs),
    tableDrawnMs: Math.round(window.__lookdev.readyMs),
  }));
  const run = { view: v.name, ...times, boardPlayableMs, transferredBytes: bytes };
  if (v.fast3g) {
    report.runs.push(run);
    await context.close();
    continue;
  }
  // A cold start opens the welcome first (GDD §6); its defaults are kept. A scene skips it.
  if (!v.scene) await page.getByRole("button", { name: "Continue", exact: true }).click();
  if (v.drawers) await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(800); // let the last piece settle
  await page.screenshot({ path: path.join(OUT, `${v.name}.png`) });
  if (v.gfx !== "2d" && v.measure !== false) {
    if (v.cpuThrottle) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: v.cpuThrottle });
    }
    const { intervals, costs } = await page.evaluate(() =>
      window.__lookdev.table.measureOrbit(240),
    );
    Object.assign(run, {
      stats: await page.evaluate(() => window.__lookdev.table.stats()),
      frameMs: {
        mean: +(sum(intervals) / intervals.length).toFixed(2),
        p95: +pct(intervals, 0.95).toFixed(2),
        max: +Math.max(...intervals).toFixed(2),
      },
      renderCostMs: {
        mean: +(sum(costs) / costs.length).toFixed(2),
        p95: +pct(costs, 0.95).toFixed(2),
        max: +Math.max(...costs).toFixed(2),
      },
      cpuThrottle: v.cpuThrottle ?? 1,
    });
  }
  report.runs.push(run);
  await context.close();
}
await browser.close();
server.close();

for (const [file, body] of gz) {
  const key = path.relative(ROOT, file);
  report.sizes[key] = { raw: fs.statSync(file).size, gzip: body.length };
}
report.sizes.total = {
  raw: sum(Object.values(report.sizes).map((s) => s.raw)),
  gzip: sum(Object.values(report.sizes).map((s) => s.gzip)),
};
console.log(JSON.stringify(report, null, 2));
