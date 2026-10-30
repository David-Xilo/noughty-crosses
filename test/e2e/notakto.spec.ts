// Notakto (TTT-4.1.2, GDD §3.7): play on several 2D boards.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);

test("pass-and-play on two 2D boards: a dead board takes no marks; the last kill loses", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Notakto");
  await page.getByLabel("Two", { exact: true }).check();
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const status = page.locator("#status");
  await expect(status).toHaveText("Player 1 to move.");
  await expect(page.getByRole("grid")).toHaveCount(2);
  // Player 1 kills board 1 with its top row; the game goes on (N2).
  for (const i of [0, 9, 1, 10, 2]) await cell(page, i).click();
  await expect(page.getByRole("grid").first()).toHaveClass(/dead/);
  await cell(page, 5).click({ force: true }); // aria-disabled, yet a player can still click it
  await expect(status).toHaveText("That board is dead: play on a live board.");
  // Player 2 completes board 2's top row: the last live board, so Player 2 loses (N3).
  await cell(page, 11).click();
  await expect(page.locator("#result h2")).toHaveText("Player 1 wins");
  await expect(page.locator("#result-detail")).toContainText(
    "Player 2 made three in a row on the last live board",
  );
  await expect(cell(page, 9)).toHaveClass(/win/);
  await page.getByRole("button", { name: "Rematch" }).click();
  await expect(status).toHaveText("Player 2 to move."); // R8
});
