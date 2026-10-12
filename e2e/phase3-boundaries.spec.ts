import { expect, test } from "@playwright/test";

test.describe("Fase 3 — superficies locales", () => {
  test("mantiene la demo bajo /demo y la práctica bajo /formatos", async ({ page }) => {
    const demoResponse = await page.goto("/demo/flash-pop");
    expect(demoResponse?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/demo\/flash-pop$/);
    await expect(page.getByRole("main").last()).toBeVisible();

    const practiceResponse = await page.goto("/formatos/eleccion-multiple");
    expect(practiceResponse?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/formatos\/eleccion-multiple$/);
    await expect(page.getByText("Ejemplos jugables", { exact: true })).toBeVisible();
  });
});
