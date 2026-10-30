// Settings and input (GDD §5, §8, TTT-4.1.7) through the real page: every setting takes
// effect and is kept across a reload.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const cells = (page: Page) => page.getByRole("gridcell");
const root = (page: Page, attr: string) =>
  page.evaluate((a) => document.documentElement.getAttribute(a), attr);
const fontSize = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
const marks = (page: Page) =>
  cells(page).evaluateAll((els) => els.filter((e) => e.getAttribute("data-mark")).length);
const camera = (page: Page) =>
  page.evaluate(() => {
    const t = (window as { __lookdev?: { table?: { stats(): { azimuth: number } } } }).__lookdev
      ?.table;
    return Math.round(t?.stats().azimuth ?? Number.NaN);
  });
const tableReady = (page: Page) =>
  page.waitForFunction(() => (window as { __lookdev?: { ready: boolean } }).__lookdev?.ready);

/** Waits until it is the player's move again, after the computer's reply. */
const yourMove = (page: Page) => expect(page.locator("#status")).toContainText("Your move");

test("every setting takes effect and is kept across a reload", async ({ page }) => {
  await page.goto("./?gfx=low");
  await tableReady(page);
  await button(page, "Settings").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeFocused();

  await page.getByLabel("Text size").fill("200");
  expect(await fontSize(page)).toBe("32px");
  await page.getByLabel("High contrast").check();
  expect(await root(page, "data-contrast")).toBe("more");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--o-lacquer"),
    ),
  ).toMatch(/^#000(000)?$/); // the build may shorten it
  await page.getByLabel("Reduced motion").check();
  expect(await root(page, "data-motion")).toBe("reduced");
  await page.getByLabel("Sound effects").fill("30");
  await page.getByRole("slider", { name: "Music" }).fill("0");
  await page.getByLabel("Music during play").check();
  await page.getByLabel("Vibration").uncheck();
  await page.getByLabel("Camera sensitivity").fill("200");
  await expect(page.locator("#camera-speed-value")).toHaveText("200%");

  // Remapping: Undo moves to Q, so Turn left takes Undo's U; Enter is refused.
  await button(page, "Undo: U. Change").click();
  await expect(button(page, "Undo: U. Change")).toHaveText("Press a key…");
  await page.keyboard.press("Enter");
  await expect(page.locator("#settings-note")).toContainText("keep their own jobs");
  await button(page, "Undo: U. Change").click();
  await page.keyboard.press("q");
  await expect(page.locator("#settings-note")).toContainText("Undo: Q. Turn left now uses U.");
  await expect(button(page, "Turn left: U. Change")).toBeVisible();

  // Kept across a reload, and in effect.
  await page.reload();
  await tableReady(page);
  expect(await fontSize(page)).toBe("32px");
  expect(await root(page, "data-contrast")).toBe("more");
  expect(await root(page, "data-motion")).toBe("reduced");
  await button(page, "Settings").click();
  await expect(page.getByLabel("Sound effects")).toHaveValue("30");
  await expect(page.locator("#effects-volume-value")).toHaveText("30%");
  await expect(page.getByRole("slider", { name: "Music" })).toHaveValue("0");
  await expect(page.getByLabel("Music during play")).toBeChecked();
  await expect(page.getByLabel("Vibration")).not.toBeChecked();
  await expect(page.getByLabel("Camera sensitivity")).toHaveValue("200");
  await expect(page.getByLabel("High contrast")).toBeChecked();
  await expect(button(page, "Undo: Q. Change")).toBeVisible();

  // In play: E turns the camera twice the default step (10°), and the remapped Q undoes.
  await page.keyboard.press("Escape");
  await openMode(page, "Classic");
  await button(page, "Play").click();
  expect(await camera(page)).toBe(0);
  await page.keyboard.press("e");
  await expect.poll(() => camera(page)).toBe(20); // reduced motion: the camera cuts
  await expect(button(page, "Turn left (U)")).toBeVisible();
  await button(page, "Reset camera (R)").click();
  await expect.poll(() => camera(page)).toBe(0);
  await cells(page).nth(4).focus(); // back from the camera buttons to the board
  await page.keyboard.press("Enter");
  await yourMove(page);
  expect(await marks(page)).toBe(2);
  await page.keyboard.press("q");
  await expect(page.locator("#status")).toContainText("You took back your move.");
  expect(await marks(page)).toBe(0);
  await expect(button(page, "Undo")).toBeDisabled();
  // Ctrl+Z works too, and the computer answers the same move the same way (R6).
  await page.keyboard.press("Enter");
  await yourMove(page);
  const reply = await cells(page).evaluateAll((els) =>
    els.findIndex((e) => e.getAttribute("data-mark") === "O"),
  );
  await page.keyboard.press("Control+z");
  expect(await marks(page)).toBe(0);
  await page.keyboard.press("Enter");
  await yourMove(page);
  await expect(cells(page).nth(reply)).toHaveAttribute("data-mark", "O");

  // Reset keys gives the defaults back.
  await page.keyboard.press("Escape");
  await button(page, "Settings").click();
  await button(page, "Reset keys").click();
  await expect(button(page, "Undo: U. Change")).toBeVisible();
});
