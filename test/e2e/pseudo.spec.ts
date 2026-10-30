// The pseudo-locale (GDD §10, TTT-4.1.8, decision P9): with ?lang=en-XA every string is
// accented and about 30% longer. This walk visits the title, settings with its notes, and
// credits at 100% and 200% text, and fails on text cut off by its box or the window, on
// English text that skipped Fluent, and on a missing message.
// It finds elements by ID and value, never by their English text.
import { expect, type Page, test } from "@playwright/test";

const go = (page: Page, gfx = "2d") => page.goto(`./?lang=en-XA&gfx=${gfx}`);
const ready = (page: Page) =>
  page.waitForFunction(
    () => (window as { __lookdev?: { saveRead?: boolean } }).__lookdev?.saveRead,
  );

/** Problems on the screen as it is now; `where` names the screen in the report. */
async function problems(page: Page, where: string): Promise<string[]> {
  const found = await page.evaluate(() => {
    const out: string[] = [];
    const english = /[A-Za-z]{3,}/; // X, O, key letters and numbers are values
    const width = document.documentElement.clientWidth;
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.className && typeof el.className === "string" ? `.${el.className.split(" ").join(".")}` : ""}`;
    /** The nearest box that cuts off what overflows it: the text's own element or a parent. */
    const clipper = (el: Element) => {
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX !== "visible" || s.overflowY !== "visible") return a;
      }
      return null;
    };
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = n.textContent?.trim() ?? "";
      const el = n.parentElement;
      if (!text || !el || !el.checkVisibility({ visibilityProperty: true })) continue;
      // Credits rows are CREDITS.md as written: names, licences and links.
      if (english.test(text) && !el.closest("#credits-body li"))
        out.push(`English text "${text}" in ${name(el)}`);
      const range = document.createRange();
      range.selectNodeContents(n);
      const box = clipper(el);
      const b = box?.getBoundingClientRect();
      const by = box ? name(box) : "";
      const scrolls = box && ["auto", "scroll"].includes(getComputedStyle(box).overflowY);
      for (const r of range.getClientRects()) {
        if (!r.width) continue;
        if (r.left < -1 || r.right > width + 1)
          out.push(`"${text}" in ${name(el)} runs off the window`);
        else if (b && (r.left < b.left - 1 || r.right > b.right + 1))
          out.push(`"${text}" in ${name(el)} is cut off at the side by ${by}`);
        else if (b && !scrolls && (r.top < b.top - 1 || r.bottom > b.bottom + 1))
          out.push(`"${text}" in ${name(el)} is cut off at the top or bottom by ${by}`);
      }
      const s = getComputedStyle(el);
      if (s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth)
        out.push(`"${text}" in ${name(el)} ends in an ellipsis`);
    }
    // The names on controls, and tooltips.
    for (const el of document.querySelectorAll("[aria-label], [title]")) {
      if (!el.checkVisibility({ visibilityProperty: true })) continue;
      for (const a of ["aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v && english.test(v)) out.push(`English ${a} "${v}" on ${name(el)}`);
      }
    }
    return [...new Set(out)];
  });
  return found.map((p) => `${where}: ${p}`);
}

/** Collects every problem of the walk, and every missing message the page reports. */
function walker(page: Page) {
  const all: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().startsWith("l10n:")) all.push(m.text());
  });
  return {
    async check(where: string) {
      all.push(...(await problems(page, where)));
    },
    done() {
      expect(all).toEqual([]);
    },
  };
}

for (const size of [100, 200]) {
  test.describe(`at ${size}% text`, () => {
    test.use({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: "http://localhost:4174",
            localStorage: [{ name: "ttt.settings.v1", value: JSON.stringify({ textSize: size }) }],
          },
        ],
      },
    });

    test("title, settings with its notes, credits and controller prompts", async ({ page }) => {
      const w = walker(page);
      await go(page);
      await ready(page);
      await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
      await w.check("title");
      await page.evaluate(() => {
        document.documentElement.dataset.input = "pad";
      });
      await w.check("title with controller prompts");

      await page.locator("#open-settings").click();
      await expect(page.locator("#settings")).toBeVisible();
      await w.check("settings");
      const keys = page.locator("#key-list button");
      await keys.nth(1).click();
      await w.check("settings, waiting for a key");
      await page.keyboard.press("q"); // Turn left's key: the two swap
      await w.check("settings, keys swapped");
      await keys.nth(0).click();
      await page.keyboard.press("ArrowUp");
      await w.check("settings, a fixed key");
      await keys.nth(0).click();
      await page.keyboard.press("Escape");
      await w.check("settings, key kept");
      await page.locator("#keys-reset").click();
      await w.check("settings, keys reset");
      await page.locator("#settings-file").setInputFiles({
        name: "settings.json",
        mimeType: "application/json",
        buffer: Buffer.from("not json"),
      });
      await expect(page.locator("#settings-note")).not.toBeEmpty();
      await w.check("settings, a bad file");
      await page.locator("#settings-done").click();

      await page.locator("#open-credits").click();
      await expect(page.locator("#credits")).toBeVisible();
      await w.check("credits");
      w.done();
    });
  });
}
