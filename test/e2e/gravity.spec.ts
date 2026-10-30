// Gravity (TTT-4.1.4, GDD §3.5): an upright 6 by 6 board where a pick drops to the lowest
// empty cell of its column, by keyboard and mouse.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);
const marks = (page: Page) =>
  page.getByRole("gridcell").evaluateAll((els) => els.map((e) => e.getAttribute("data-mark")));

test("pass-and-play on the 2D board: marks drop down their column; a full column refuses; four in a column wins", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Gravity");
  await expect(page.locator("#rule-card .fairness")).toHaveText("Perfect play draws.");
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  // The mouse rests where Play was, over column 2: keyboard play starts with it away.
  await page.mouse.move(0, 0);
  await expect(page.getByRole("grid")).toHaveCount(1);
  await expect(page.getByRole("gridcell")).toHaveCount(36);
  // Focus starts at the bottom of column 3; Enter one row up still drops to the bottom.
  await expect(cell(page, 32)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(cell(page, 32)).toHaveClass(/aimed/);
  await page.keyboard.press("Enter");
  await expect(cell(page, 32)).toHaveAttribute("data-mark", "X");
  await expect(cell(page, 26)).toHaveAttribute("data-mark", "");
  // Pointing at a column shows the ghost where the mark would land: on top of the X.
  await cell(page, 2).hover();
  await expect(cell(page, 26)).toHaveClass(/aimed/);
  // Column 6 fills by clicks on its top cell, O first; then it refuses a seventh mark.
  for (let i = 0; i < 6; i++) await cell(page, 5).click();
  expect((await marks(page)).filter((_, i) => i % 6 === 5)).toEqual(["X", "O", "X", "O", "X", "O"]);
  await expect(cell(page, 5)).toHaveAttribute("aria-disabled", "true");
  await cell(page, 5).click({ force: true }); // aria-disabled, yet a player can still click it
  await expect(page.locator("#status")).toHaveText("That column is full.");
  // O takes column 1 by clicks anywhere in it; X answers in column 2.
  for (const i of [0, 7, 12, 1, 24, 31]) await cell(page, i).click();
  await expect(page.locator("#result")).toBeHidden(); // three in a column is not a win
  await cell(page, 0).click();
  await expect(page.locator("#result h2")).toHaveText("O wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Four in a row, from row 3, column 1 to row 6, column 1. 14 moves.",
  );
  await expect(cell(page, 18)).toHaveClass(/win/);
});
