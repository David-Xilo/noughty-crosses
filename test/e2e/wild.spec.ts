// Misère wild (TTT-4.1.15, GDD §3.8): each turn places an X or an O, chosen by the
// "Place" button or the M key; three of one mark in a row loses for whoever placed it.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);

test("pass-and-play: both players place both marks, and the third of a line loses", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Misère wild");
  await expect(page.locator("#rule-card .fairness")).toHaveText(
    "Perfect play draws. Tip: there's only one safe first move.",
  );
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const swap = page.locator("#mark-swap");
  await expect(swap).toHaveText("Place X");
  await cell(page, 4).click();
  await expect(page.locator("#status")).toHaveText(
    "Player 1 played X at row 2, column 2. Player 2 to move.",
  );
  for (const i of [0, 1, 3]) await cell(page, i).click();
  // The M key swaps the mark, and the button follows.
  await page.keyboard.press("m");
  await expect(swap).toHaveText("Place O");
  for (const i of [2, 6, 8]) await cell(page, i).click();
  await expect(page.locator("#result")).toBeHidden();
  await swap.click();
  await expect(swap).toHaveText("Place X");
  await swap.click();
  await cell(page, 7).click(); // Player 2's O completes the bottom row
  await expect(page.locator("#result h2")).toHaveText("Player 1 wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Player 2 made three in a row, from row 3, column 1 to row 3, column 3. 8 moves.",
  );
});

test("against the computer: its reply names the mark it placed", async ({ page }) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Misère wild");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await cell(page, 4).click();
  await expect(page.locator("#status")).toHaveText(
    /^The computer played [XO] at row \d, column \d\. Your move\.$/,
  );
});
