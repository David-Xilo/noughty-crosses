// The screens and flow (GDD §6, TTT-4.1.6) through the real page: title, drawers, rule card
// and demo, setup, table, pause, settings, result, credits and back, by keyboard; Continue
// from a version 1 save (§8), an unreadable save, and progress (§4.3).
import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { putStored } from "./support";

const ready = (page: Page) =>
  page.waitForFunction(
    () => (window as { __lookdev?: { saveRead?: boolean } }).__lookdev?.saveRead,
  );
const cells = (page: Page) => page.getByRole("gridcell");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
/** The title's Continue button, whatever game it names. */
const resumeButton = (page: Page) => page.getByRole("button", { name: /^Continue/ });

/** Moves the grid's focus to `target` with the arrow keys and presses Enter (3 by 3). */
async function playByKeys(page: Page, target: number) {
  const from = await cells(page).evaluateAll((els) =>
    els.indexOf(document.activeElement as HTMLElement),
  );
  expect(from).toBeGreaterThanOrEqual(0);
  const [fr, fc, tr, tc] = [Math.floor(from / 3), from % 3, Math.floor(target / 3), target % 3];
  for (let r = fr; r !== tr; r += Math.sign(tr - fr))
    await page.keyboard.press(tr > fr ? "ArrowDown" : "ArrowUp");
  for (let c = fc; c !== tc; c += Math.sign(tc - fc))
    await page.keyboard.press(tc > fc ? "ArrowRight" : "ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(cells(page).nth(target)).not.toHaveAttribute("data-mark", "");
}

const storedKeys = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open("noughty-crosses", 1);
        open.onsuccess = () => {
          const req = open.result.transaction("kv").objectStore("kv").getAllKeys();
          req.onsuccess = () => resolve(req.result.map(String));
        };
      }),
  );
const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(new URL(`../fixtures/saves/${name}.json`, import.meta.url), "utf8"));

test("the whole flow by keyboard: title, drawers, rule card, setup, play, pause, settings, result, credits", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await ready(page);
  await expect(resumeButton(page)).toBeHidden();
  await expect(button(page, "Play")).toBeFocused();
  await page.keyboard.press("Enter");

  // The drawers: one per mode, focus on the first; "?" opens the rule card and its demo.
  await expect(page.locator(".drawer-pull")).toHaveCount(13); // Cube is hidden (P28)
  await expect(button(page, "Classic")).toBeFocused();
  await expect(button(page, "Vanishing")).toContainText(/keeps three marks.*Perfect play draws/);
  await page.keyboard.press("Tab");
  await expect(button(page, "How to play Classic")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Classic" })).toBeFocused();
  await expect(page.locator(".demo-caption")).toContainText("Three in a row wins");
  await page.keyboard.press("Escape");
  await expect(button(page, "How to play Classic")).toBeFocused();

  // A drawer opens the setup card; Esc goes back one step.
  await page.keyboard.press("Tab");
  await expect(button(page, "Vanishing")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#setup-title")).toHaveText("Vanishing");
  await page.keyboard.press("Escape");
  await expect(button(page, "Vanishing")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("radio", { name: "Computer" })).toBeFocused();
  await page.keyboard.press("ArrowDown"); // A friend, same device
  await expect(page.getByRole("radio", { name: "A friend, same device" })).toBeChecked();
  await button(page, "Play").focus();
  await page.keyboard.press("Enter");

  // The table; Esc pauses, Settings and back, Esc resumes.
  await expect(page.locator("#status")).toHaveText("X to move.");
  for (const c of [0, 4, 8]) await playByKeys(page, c);
  await page.keyboard.press("Escape");
  await expect(button(page, "Resume")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeFocused();
  await expect(page.getByRole("grid")).toBeVisible(); // the game stays on the table
  const effects = page.getByRole("slider", { name: "Sound effects" });
  await effects.focus();
  await page.keyboard.press("Home");
  await expect(page.locator("#effects-volume-value")).toHaveText("0%");
  await page.keyboard.press("Escape");
  await expect(button(page, "Settings")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#status")).toContainText("O to move");
  for (const c of [2, 6, 3, 7]) await playByKeys(page, c);

  // The result; Esc goes to the drawers, then to the title; the game left nothing to continue.
  await expect(page.locator("#result-title")).toHaveText("X wins");
  await expect(page.locator("#result-title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button(page, "Vanishing")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button(page, "Play")).toBeFocused();
  await expect(resumeButton(page)).toBeHidden();

  // Credits come from CREDITS.md.
  await button(page, "Credits").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Credits" })).toBeFocused();
  await expect(page.locator("#credits")).toContainText("Poly Haven");
  await expect(page.locator("#credits")).toContainText("5.3.0: SIL OFL 1.1, body and UI type");
  await page.keyboard.press("Escape");
  await expect(button(page, "Credits")).toBeFocused();
  // The effects volume was kept.
  await page.reload();
  await button(page, "Settings").click();
  await expect(page.getByRole("slider", { name: "Sound effects" })).toHaveValue("0");
});

test("an unreadable save is reported and kept; stored progress shows its badges", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await ready(page);
  await putStored(page, "game", fixture("corrupt-illegal-move"));
  await putStored(page, "progress", {
    version: 1,
    counts: {
      misere: { sharp: { win: 0, draw: 2, loss: 1 } },
      bigboard: { sharp: { win: 1, draw: 0, loss: 0 } },
    },
  });
  await page.reload();
  await ready(page);
  await expect(page.locator("#save-note")).toContainText("could not be read");
  await expect(resumeButton(page)).toBeHidden();
  expect((await storedKeys(page)).filter((k) => k.startsWith("unreadable-"))).toHaveLength(1);
  expect(await storedKeys(page)).not.toContain("game");
  await button(page, "Play").click();
  await expect(page.locator("#badge-misere")).toHaveText("Drew Sharp");
  await expect(page.locator("#badge-bigboard")).toHaveText("Beat Sharp");
  await expect(page.locator("#badge-classic")).toBeHidden();
  await button(page, "Misère").click();
  await page.getByRole("radio", { name: "Sharp" }).check();
  await expect(page.locator("#record")).toHaveText(
    "Your record against Sharp: 0 wins, 2 draws, 1 loss.",
  );
});

test("a version 1 save made by the game continues where it stopped", async ({ page }) => {
  await page.goto("./?gfx=2d");
  await ready(page);
  await putStored(page, "game", fixture("v1-notakto-friend"));
  await page.reload();
  await ready(page);
  await button(page, "Continue: Notakto with a friend, Player 1 to move").click();
  await expect(page.getByRole("grid")).toHaveCount(3);
  await expect(page.getByRole("grid").first()).toHaveClass(/dead/);
  await expect(page.locator("#status")).toHaveText("Player 1 to move.");
});
