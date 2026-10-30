// Overtime (TTT-4.1.11, GDD §3.8): a Classic draw grows the board to 5 by 5 on the 2D
// board and the 3D table, and four in a row wins; the computer plays on from a save.
import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { openMode, putStored } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);
type Lookdev = {
  __lookdev: {
    ready: boolean;
    saveRead?: boolean;
    table: { cellPoints(): { x: number; y: number }[]; stats(): { pieces: number } };
  };
};

/** A Classic draw, X first: X's ninth mark at the bottom right grows the board (O2). */
const DRAW = [4, 0, 2, 6, 3, 5, 1, 7];

test("pass-and-play on the 2D board: a draw grows the board, focus stays on the last mark, and four in a row wins", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Overtime");
  await expect(page.locator("#rule-card .fairness")).toHaveText(
    "Perfect play draws, before and after the board grows.",
  );
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("gridcell")).toHaveCount(9);
  for (const i of DRAW) await cell(page, i).click();
  // The ninth mark by keyboard: from the bottom-right cell's left neighbour.
  await cell(page, 7).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("gridcell")).toHaveCount(25);
  await expect(cell(page, 18)).toBeFocused();
  await expect(cell(page, 18)).toHaveAttribute("data-mark", "X");
  await expect(page.locator("#status")).toHaveText(
    "X played row 4, column 4. A draw on 3 by 3: the board grows to 5 by 5. Now four in a row wins. O to move.",
  );
  // O holds two cells of the diagonal from row 2, column 5; X does not block it.
  for (const i of [9, 3]) await cell(page, i).click();
  await expect(page.locator("#result")).toBeHidden();
  await cell(page, 21).click();
  await expect(page.locator("#result h2")).toHaveText("O wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Four in a row, from row 2, column 5 to row 5, column 2. 12 moves.",
  );
});

test("a saved game against Keen continues on the 3D table: the computer opens the ring from its worker", async ({
  page,
}) => {
  const save = JSON.parse(
    fs.readFileSync(new URL("../fixtures/saves/v1-overtime-keen.json", import.meta.url), "utf8"),
  );
  await page.goto("./?gfx=low");
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev?.saveRead);
  await putStored(page, "game", save);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev?.saveRead);
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForFunction(() => (window as unknown as Lookdev).__lookdev.ready);
  await expect(page.getByRole("gridcell")).toHaveCount(25);
  // The computer's ring move: ten marks, one of them outside the centre.
  await expect(page.locator('[role="gridcell"]:not([data-mark=""])')).toHaveCount(10);
  const points = await page.evaluate(() =>
    (window as unknown as Lookdev).__lookdev.table.cellPoints(),
  );
  expect(points).toHaveLength(25);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Lookdev).__lookdev.table.stats().pieces))
    .toBe(10);
  await expect(page.locator("#status")).toHaveText(/Your move\.$/);
});
