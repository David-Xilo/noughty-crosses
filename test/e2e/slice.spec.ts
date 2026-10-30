// The slice through the real page (TTT-3.2): a click on the 3D board.
import { expect, type Page, test } from "@playwright/test";
import { openMode } from "./support";

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);
const ready = (page: Page) =>
  page.waitForFunction(() => (window as { __lookdev?: { ready: boolean } }).__lookdev?.ready);

test("a click on the 3D board places a piece in that cell; a right-drag does not", async ({
  page,
}) => {
  await page.goto("./?gfx=high");
  await openMode(page, "Classic");
  await page.getByLabel("A friend, same device").check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await ready(page);
  const points = await page.evaluate(() =>
    (
      window as unknown as { __lookdev: { table: { cellPoints(): { x: number; y: number }[] } } }
    ).__lookdev.table.cellPoints(),
  );
  const p = points[5] as { x: number; y: number };
  await page.mouse.move(5, 790); // off the board: no cursor ring or ghost
  await page.waitForTimeout(300);
  const empty = await page.evaluate(() => {
    const t = (window as unknown as { __lookdev: { table: { stats(): object } } }).__lookdev.table;
    return t.stats() as { triangles: number };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(p.x + 80, p.y, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await expect(cell(page, 5)).toHaveAttribute("data-mark", "");
  const again = await page.evaluate(() =>
    (
      window as unknown as { __lookdev: { table: { cellPoints(): { x: number; y: number }[] } } }
    ).__lookdev.table.cellPoints(),
  );
  const q = again[5] as { x: number; y: number };
  await page.mouse.click(q.x, q.y);
  await expect(cell(page, 5)).toHaveAttribute("data-mark", "X");
  // The table was first drawn empty; the piece must still be drawn (no stale culling).
  await page.mouse.move(5, 790);
  await page.waitForTimeout(400);
  const drawn = await page.evaluate(() => {
    const t = (window as unknown as { __lookdev: { table: { stats(): object } } }).__lookdev.table;
    return t.stats() as { pieces: number; triangles: number };
  });
  expect(drawn.pieces).toBe(1);
  expect(drawn.triangles).toBeGreaterThan(empty.triangles);
});
