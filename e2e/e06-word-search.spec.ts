import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: { alice: FixtureAccount; bob: FixtureAccount };
  data: { room: { slug: string } };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/e06.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva E06/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash E06 Word-search" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

function cell(board: Locator, row: number, column: number) {
  return board.getByRole("button", { name: new RegExp(`Fila ${row}, columna ${column}`) });
}

test.describe("E06 — Word-search competitivo", () => {
  test("persiste errores, oculta soluciones y recupera selecciones idempotentes", async ({ page }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: "Encuentra CASA y ÑANDÚ" })).toBeVisible();
    expect(await page.content()).not.toContain("positionsByTargetId");
    expect(await page.content()).not.toContain("startCell");

    const board = page.getByRole("grid", { name: "Sopa de letras de 6 filas y 6 columnas" });
    await cell(board, 1, 1).click();
    await cell(board, 1, 6).click();
    await expect(page.getByText("1 error")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Encuentra CASA y ÑANDÚ" })).toBeVisible();
    await expect(page.getByText("1 error")).toBeVisible();

    let firstResponse = true;
    const requestBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/competitive/attempts/*/word-search/select", async (route) => {
      requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (!firstResponse) {
        await route.continue();
        return;
      }
      firstResponse = false;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e06-lost-response" } }),
      });
      await response.body();
    });

    await cell(board, 1, 1).click();
    await cell(board, 1, 4).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByText("1 / 2")).toBeVisible();

    await cell(board, 2, 5).click();
    await cell(board, 2, 1).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").filter({ hasText: "Sopa" }).locator("summary").click();
    await expect(page.getByText("Las palabras se encuentran en la primera y segunda fila.")).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash E06", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva E06/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash E06 Word-search" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
