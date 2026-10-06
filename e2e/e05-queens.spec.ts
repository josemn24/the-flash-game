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
    await expect(page.getByRole("heading", { name: "Coloca las seis coronas" })).toBeVisible();
    await expect(page.getByText("1/6 coronas")).toBeVisible();
    expect(await page.content()).not.toContain('"solution"');

    const board = page.getByRole("grid", { name: "Tablero Queens de 6 por 6" });
    const validationBodies: Array<Record<string, unknown>> = [];
    let failedValidations = 0;
    await page.route("**/api/competitive/attempts/*/queens/validate", async (route) => {
      validationBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (failedValidations === 0) {
        await route.continue();
        return;
      }
      failedValidations--;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e05-lost-response" } }),
      });
      await response.body();
    });
    const draftResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/queens/draft") && response.request().method() === "POST",
    );
    await board.getByRole("gridcell", { name: /Fila 2, columna 4/ }).click();
    await expect(page.getByText("2/6 coronas")).toBeVisible();
    expect((await draftResponse).ok()).toBe(true);
    expect(validationBodies).toHaveLength(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Coloca las seis coronas" })).toBeVisible();
    await expect(page.getByText("2/6 coronas")).toBeVisible();

    await board.getByRole("gridcell", { name: /Fila 3, columna 2/ }).click();
    await board.getByRole("gridcell", { name: /Fila 4, columna 5/ }).click();
    await board.getByRole("gridcell", { name: /Fila 5, columna 3/ }).click();
    await board.getByRole("gridcell", { name: /Fila 5, columna 4/ }).click();
    await expect(page.getByText("El tablero no es correcto.")).toBeVisible();
    expect(validationBodies).toHaveLength(1);

    await board.getByRole("gridcell", { name: /Fila 5, columna 4/ }).click();
    failedValidations = 2;
    await board.getByRole("gridcell", { name: /Fila 6, columna 6/ }).click();
    await expect.poll(() => validationBodies.length).toBe(3);
    await expect(page.getByRole("button", { name: "Reintentar validación" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar validación" }).click();
    await expect.poll(() => validationBodies.length).toBe(4);
    expect(validationBodies[3]).toEqual(validationBodies[1]);
    expect(validationBodies[1]?.idempotencyKey).toBe(validationBodies[2]?.idempotencyKey);

    const miniBoard = page.getByRole("grid", { name: "Tablero Queens de 4 por 4" });
    await expect(page.getByRole("heading", { name: "Coloca las cuatro coronas" })).toBeVisible();
    await expect(page.getByText("1/4 coronas")).toBeVisible();
    await miniBoard.getByRole("gridcell", { name: /Fila 2, columna 1/ }).click();
    await miniBoard.getByRole("gridcell", { name: /Fila 3, columna 4/ }).click();
    await miniBoard.getByRole("gridcell", { name: /Fila 4, columna 2/ }).click();
    await expect(page.getByText("4/4 coronas")).toBeVisible();
    await expect.poll(() => validationBodies).toHaveLength(5);
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    const firstQueensReview = page.locator("details").filter({ hasText: /^02Queens/ });
    await firstQueensReview.locator("summary").click();
    await expect(
      firstQueensReview.getByText("Una corona por fila, columna y región."),
    ).toBeVisible();
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
