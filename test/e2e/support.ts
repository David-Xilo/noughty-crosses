// Shared steps for the playthroughs: from the title, through the drawers, to a mode's
// setup card (GDD §6), and the game's storage.
import type { Page } from "@playwright/test";

export async function openMode(page: Page, name: string) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}

/** Writes a value into the game's storage, as a stored save or progress would be. */
export const putStored = (page: Page, key: string, value: unknown) =>
  page.evaluate(
    ([k, v]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("noughty-crosses", 1);
        open.onsuccess = () => {
          const tx = open.result.transaction("kv", "readwrite");
          tx.objectStore("kv").put(v, k as string);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, value] as const,
  );
