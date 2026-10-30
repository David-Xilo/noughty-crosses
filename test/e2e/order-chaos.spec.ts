// Order and Chaos (TTT-4.1.18, GDD §3.8): both sides place an X or an O; five of one mark in
// a row wins for Order, the side that moves first; Chaos wins once no five can be made.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);

test("pass-and-play: the rule card's game, named by role, ends in Order's open four", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Order and Chaos");
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await cell(page, 14).click();
  await expect(page.locator("#status")).toHaveText(
    "Order played X at row 3, column 3. Chaos to move.",
  );
  // The M key swaps the mark before each move: O, X, O…
  for (const i of [13, 20, 21, 8, 9, 26, 2, 32]) {
    await page.keyboard.press("m");
    await cell(page, i).click();
  }
  await expect(page.locator("#result h2")).toHaveText("Order wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Five in a row, from row 2, column 3 to row 6, column 3. 9 moves.",
  );
});

test("against the computer as Chaos: the computer opens as Order", async ({ page }) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Order and Chaos");
  await page.getByLabel("Second").check();
  await expect(page.locator("#rule-card .fairness")).toHaveText(
    "Order is thought to win with perfect play. Play two games, so each side has a turn as Order. You play Chaos.",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("#status")).toHaveText(
    /^The computer played [XO] at row \d, column \d\. Your move\. You play Chaos: stop every five\.$/,
  );
});
