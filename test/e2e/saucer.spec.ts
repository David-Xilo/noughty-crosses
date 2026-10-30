// Saucer (TTT-4.1.17, GDD §3.8): after every third move a flying saucer pushes the piece just
// placed one cell clockwise, or carries it off from the centre; a push can win.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);

test("pass-and-play: the rule card's game, a push, a carry and a winning push", async ({
  page,
}) => {
  await page.goto("./?gfx=2d");
  await openMode(page, "Saucer");
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const status = page.locator("#status");
  await cell(page, 4).click({ force: true });
  await expect(status).toHaveText("The first piece may not go in the centre.");
  await cell(page, 1).click();
  await cell(page, 2).click();
  await expect(status).toHaveText(
    "O played row 1, column 3. X to move. The saucer takes the next piece placed.",
  );
  await expect(page.locator(".saucer2d")).toHaveClass(/waits/);
  await cell(page, 6).click();
  await expect(status).toHaveText(
    "X played row 3, column 1. The saucer pushed X from row 3, column 1 to row 2, column 1. O to move.",
  );
  await expect(cell(page, 3)).toHaveAttribute("data-mark", "X");
  await expect(cell(page, 6)).toHaveAttribute("data-mark", "");
  for (const i of [5, 8, 4]) await cell(page, i).click();
  await expect(status).toHaveText(
    "O played row 2, column 2. The saucer carried O away from the centre. X to move.",
  );
  await expect(cell(page, 4)).toHaveAttribute("data-mark", "");
  for (const i of [0, 4, 7]) await cell(page, i).click();
  await expect(page.locator("#result h2")).toHaveText("X wins");
  await expect(page.locator("#result-detail")).toHaveText(
    "Three in a row, from row 1, column 1 to row 3, column 1. 9 moves.",
  );
});
