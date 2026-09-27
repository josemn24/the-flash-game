import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: { alice: FixtureAccount; bob: FixtureAccount };
  data: { room: { slug: string } };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/e05.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openFlash(page: Page, account: FixtureAccount) {
  await signIn(page, account);
  await page.getByRole("link", { name: /Abrir sala Sala competitiva E05/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash E05 Queens" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.describe("E05 — Queens competitivo", () => {
  test("persiste coronas, recupera progreso y resuelve server-side", async ({ page }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: "Coloca las cinco coronas" })).toBeVisible();
    await expect(page.getByText("1/5 coronas")).toBeVisible();
    expect(await page.content()).not.toContain('"solution"');

    const board = page.getByRole("grid", { name: "Tablero Queens de cinco por cinco" });
    const validationBodies: Array<Record<string, unknown>> = [];
    let loseNextValidation = false;
    await page.route("**/api/competitive/attempts/*/queens/validate", async (route) => {
      validationBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (!loseNextValidation) {
        await route.continue();
        return;
      }
      loseNextValidation = false;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e05-lost-response" } }),
      });
      await response.body();
    });
    await board.getByRole("gridcell", { name: /Fila 2, columna 5/ }).click();
    await expect(page.getByText("2/5 coronas")).toBeVisible();
    await page.waitForTimeout(500);
    expect(validationBodies).toHaveLength(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Coloca las cinco coronas" })).toBeVisible();
    await expect(page.getByText("2/5 coronas")).toBeVisible();

    await board.getByRole("gridcell", { name: /Fila 3, columna 1/ }).click();
    await board.getByRole("gridcell", { name: /Fila 4, columna 1/ }).click();
    await board.getByRole("gridcell", { name: /Fila 4, columna 5/ }).click();
    await expect(page.getByText("El tablero no es correcto.")).toBeVisible();
    expect(validationBodies).toHaveLength(1);

    await board.getByRole("gridcell", { name: /Fila 4, columna 1/ }).click();
    await board.getByRole("gridcell", { name: /Fila 4, columna 5/ }).click();
    loseNextValidation = true;
    await board.getByRole("gridcell", { name: /Fila 4, columna 4/ }).click();
    await board.getByRole("gridcell", { name: /Fila 5, columna 2/ }).click();
    await expect(page.getByRole("button", { name: "Reintentar validación" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar validación" }).click();
    expect(validationBodies).toHaveLength(3);
    expect(validationBodies[1]?.idempotencyKey).toBe(validationBodies[2]?.idempotencyKey);
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").filter({ hasText: "Queens" }).locator("summary").click();
    await expect(page.getByText("Una corona por fila, columna y región.")).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash E05", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva E05/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash E05 Queens" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
