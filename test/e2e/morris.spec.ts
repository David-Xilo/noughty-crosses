// Three men's morris (TTT-4.1.16, GDD §3.8): three pieces each, then a slide is two picks,
// the piece and then a neighbouring empty cell; three in a row wins.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);
/** A refused pick: the cell is aria-disabled, yet a player can still click it. */
const tryCell = (page: Page, i: number) => cell(page, i).click({ force: true });

test("pass-and-play: place three each, pick a piece up, slide it and win", async ({ page }) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Three men's morris");
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const status = page.locator("#status");
  await tryCell(page, 4);
  await expect(status).toHaveText("The first piece may not go in the centre.");
  for (const i of [0, 8, 3, 6, 7, 5]) await cell(page, i).click();
  await expect(status).toHaveText("O played row 2, column 3. X to move.");
  // Placing is over: an empty cell is not a piece, and a piece moves only one step.
  await tryCell(page, 4);
  await expect(status).toHaveText("First choose one of your pieces to move.");
  await cell(page, 3).click();
  await expect(status).toHaveText(
    "Picked up the piece at row 2, column 1. Choose a neighbouring empty cell, or the piece again to put it back.",
  );
  await expect(cell(page, 3)).toHaveClass(/selected/);
  await tryCell(page, 2);
  await expect(status).toHaveText("Move to an empty cell next to the piece, along a line.");
  await cell(page, 4).click();
  await expect(status).toHaveText("X moved from row 2, column 1 to row 2, column 2. O to move.");
  await cell(page, 5).click();
  await cell(page, 2).click();
  await cell(page, 0).click();
  await cell(page, 1).click();
  await expect(page.locator("#result h2")).toHaveText("X wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Three in a row, from row 1, column 2 to row 3, column 2. 9 moves.",
  );
});

test("against the computer: it places a piece in reply", async ({ page }) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Three men's morris");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await cell(page, 0).click();
  await expect(page.locator("#status")).toHaveText(
    /^The computer played row \d, column \d\. Your move\.$/,
  );
});
