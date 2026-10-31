import { expect, type Locator } from "@playwright/test";

/** Two independent activations: no double-click gesture is required. */
export async function placeQueensCrown(cell: Locator) {
  await cell.click();
  await expect(cell).toHaveAccessibleName(/marcada con X/);
  await cell.click();
}
