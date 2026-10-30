// Cube (TTT-4.1.12, GDD §3.8): after the 7th mark the cube grows to 5 by 5 by 5 on the 2D
// board and the 3D table, and four in a line wins; the computer plays on from a save. The
// cabinet hides Cube until its real 3D look (P28), so both games start from a save.
import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { putStored } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);
type Lookdev = {
  __lookdev: {
    ready: boolean;
    saveRead?: boolean;
    table: {
      cellPoints(): { x: number; y: number }[];
      stats(): { pieces: number; polar: number };
    };
  };
};

const save = (name: string) =>
  JSON.parse(fs.readFileSync(new URL(`../fixtures/saves/${name}.json`, import.meta.url), "utf8"));

test("pass-and-play on the 2D board from a save: the 7th mark grows the cube, PageUp changes the layer, and four in a line wins", async ({
  page,
}) => {
  await expect(page.locator(".drawer-pull", { hasText: "Cube" })).toHaveCount(0);
  await page.goto("./?gfx=2d");
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev?.saveRead);
  // X holds three of the bottom back row; six marks, no line.
  await putStored(page, "game", save("v1-cube-friend"));
  await page.reload();
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev?.saveRead);
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByRole("gridcell")).toHaveCount(64);
  // The 7th mark by keyboard: one layer up from the bottom layer's third row, first column.
  await cell(page, 8).focus();
  await page.keyboard.press("PageUp");
  await expect(cell(page, 24)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("gridcell")).toHaveCount(125);
  await expect(cell(page, 40)).toBeFocused();
  await expect(cell(page, 40)).toHaveAttribute("data-mark", "X");
  await expect(page.locator("#status")).toHaveText(
    "X played layer 2, row 4, column 1. After the 7th mark the cube grows to 5 by 5 by 5, with new cells on the top, right and back. Four in a line still wins. O to move.",
  );
  // O plays on the new top layer; X's row, one row further from the back, gains a 4th cell.
  await cell(page, 100).click();
  await expect(page.locator("#result")).toBeHidden();
  await cell(page, 8).click();
  await expect(page.locator("#result h2")).toHaveText("X wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Four in a row, from layer 1, row 2, column 1 to layer 1, row 2, column 4. 9 moves.",
  );
});

test("a saved game against Keen continues on the 3D table: the computer blocks the row from its worker", async ({
  page,
}) => {
  await page.goto("./?gfx=low");
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev?.saveRead);
  await putStored(page, "game", save("v1-cube-keen"));
  await page.reload();
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev?.saveRead);
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev.ready);
  await expect(page.getByRole("gridcell")).toHaveCount(125);
  await expect(cell(page, 8)).toHaveAttribute("data-mark", "O");
  const points = await page.evaluate(() =>
    (window as unknown as Lookdev).__lookdev.table.cellPoints(),
  );
  expect(points).toHaveLength(125);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Lookdev).__lookdev.table.stats().pieces))
    .toBe(8);
  await expect(page.locator("#status")).toHaveText(/Your move\.$/);
  // The layer buttons, for touch: the cursor goes one layer up, the same row and column,
  // and the camera does not tilt.
  const polar = () =>
    page.evaluate(() => (window as unknown as Lookdev).__lookdev.table.stats().polar);
  const before = await polar();
  const from = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"]')].findIndex(
      (c) => (c as HTMLElement).tabIndex === 0,
    ),
  );
  expect(from).toBeLessThan(100);
  await page.getByRole("button", { name: "Layer up" }).click();
  await expect(cell(page, from + 25)).toBeFocused();
  await page.waitForTimeout(500); // a tilt eases in
  expect(await polar()).toBe(before);
});
