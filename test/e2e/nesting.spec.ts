// Nesting (TTT-4.1.19, GDD §3.8): a move is two picks, a piece from the tray beside the board
// or one of the player's top pieces, then a cell it fits on; three on top in a row wins.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);
/** A refused pick: the cell is aria-disabled, yet a player can still click it. */
const tryCell = (page: Page, i: number) => cell(page, i).click({ force: true });
const tray = (page: Page, size: "Small" | "Medium" | "Large") =>
  page.locator("#tray").getByRole("button", { name: new RegExp(`^${size}`) });

test("pass-and-play: the rule card's game, with a cover, a refusal and a piece put back", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Nesting");
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const status = page.locator("#status");
  await tryCell(page, 4);
  await expect(status).toHaveText(
    "First choose a piece: one from the tray beside the board, or one of yours on the board.",
  );
  await expect(tray(page, "Large")).toHaveAccessibleName("Large X, 2 left");
  await tray(page, "Large").click();
  await expect(tray(page, "Large")).toHaveAttribute("aria-pressed", "true");
  await cell(page, 4).click();
  await expect(status).toHaveText("X placed a large piece on row 2, column 2. O to move.");
  await tray(page, "Small").click();
  await cell(page, 2).click();
  // X covers O's small piece with a medium one; only the top piece shows.
  await tray(page, "Medium").click();
  await cell(page, 2).click();
  await expect(status).toHaveText("X placed a medium piece on row 1, column 3. O to move.");
  await expect(cell(page, 2).locator(".piece")).toHaveAttribute("data-size", "1");
  // The M key takes the next size from the tray: a small piece does not fit over a large one.
  await page.keyboard.press("m");
  await tryCell(page, 4);
  await expect(status).toHaveText("That piece fits only on an empty cell or over a smaller piece.");
  await page.keyboard.press("m");
  await page.keyboard.press("m");
  await cell(page, 6).click();
  // X picks up its large piece, then puts it back.
  await cell(page, 4).click();
  await expect(status).toHaveText(
    "Large piece in hand, from row 2, column 2. Put it on an empty cell or over a smaller piece, or press it again to put it back.",
  );
  await expect(cell(page, 4)).toHaveClass(/selected/);
  await cell(page, 4).click();
  await expect(status).toHaveText("X to move.");
  await tray(page, "Large").click();
  await cell(page, 8).click();
  await tray(page, "Large").click();
  await cell(page, 0).click();
  await tray(page, "Small").click();
  await cell(page, 5).click();
  await expect(page.locator("#result h2")).toHaveText("X wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Three in a row, from row 1, column 3 to row 3, column 3. 7 moves.",
  );
});

test("against the computer: it places a piece in reply", async ({ page }) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Nesting");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await tray(page, "Large").click();
  await cell(page, 4).click();
  await expect(page.locator("#status")).toHaveText(
    /^The computer placed a (small|medium|large) piece on row \d, column \d\. Your move\.$/,
  );
});
