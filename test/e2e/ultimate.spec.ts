// Ultimate (TTT-4.1.5, GDD §3.6): nine boards, where the cell played sends the opponent to
// a board, by mouse and keyboard on the 2D board.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);
const board = (page: Page, b: number) => page.getByRole("grid").nth(b);
// A legal game X wins on the diagonal of boards 1, 5 and 9, claimed on moves 15, 17 and 23.
const WIN = [
  44, 72, 5, 52, 64, 17, 75, 31, 41, 51, 62, 80, 76, 40, 38, 26, 77, 45, 2, 24, 58, 54, 8,
];

test("pass-and-play on the 2D board: a move sends the opponent to a board; claimed boards close; three boards in a row win", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Ultimate");
  await expect(page.locator("#rule-card .fairness")).toHaveText("Unsolved: a test of skill.");
  await expect(page.getByLabel(/Fair start/)).not.toBeChecked();
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("grid")).toHaveCount(9);
  await expect(page.getByRole("gridcell")).toHaveCount(81);
  await expect(page.locator("#status")).toHaveText("X to move, on any open board.");
  // Keyboard: focus starts on board 1's centre; the arrows cross into the next board.
  await expect(cell(page, 4)).toBeFocused();
  for (const key of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown"])
    await page.keyboard.press(key);
  await expect(cell(page, 36)).toBeFocused();
  // Board 5, row 3, column 3 sends O to board 9, which glows.
  await cell(page, 44).click();
  await expect(page.locator("#status")).toHaveText(
    "X played board 5, row 3, column 3. O to move, on board 9.",
  );
  await expect(board(page, 8)).toHaveClass(/target/);
  await expect(cell(page, 0)).toHaveAttribute("aria-disabled", "true");
  await cell(page, 0).click({ force: true });
  await expect(page.locator("#status")).toHaveText(
    "Play on the glowing board: the last move sent you there.",
  );
  // Board 5's top row claims it for X on move 15; its cells close.
  for (const c of WIN.slice(1, 15)) await cell(page, c).click();
  await expect(board(page, 4)).toHaveClass(/claimed/);
  await expect(cell(page, 36)).toHaveAttribute("aria-disabled", "true");
  // Move 21 sends O to board 5, which is closed: any open board will do (U3).
  for (const c of WIN.slice(15, 21)) await cell(page, c).click();
  await expect(page.locator("#status")).toContainText("O to move, on any open board.");
  await cell(page, 36).click({ force: true });
  await expect(page.locator("#status")).toHaveText(
    "That board is decided: play on a glowing board.",
  );
  for (const c of WIN.slice(21, -1)) await cell(page, c).click();
  await expect(page.locator("#result")).toBeHidden();
  await cell(page, WIN.at(-1) as number).click();
  await expect(page.locator("#result h2")).toHaveText("X wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Three boards in a row, from board 1 to board 9. 23 moves.",
  );
  await expect(board(page, 4)).toHaveClass(/win/);
});
