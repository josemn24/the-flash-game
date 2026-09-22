import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = { users: { alice: FixtureAccount; charlie: FixtureAccount; bob: FixtureAccount } };

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/f16.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva F16/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash F16 Zip" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

async function solveZip(page: Page) {
  const path = [0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22, 23, 24];
  const cells = page.locator('[role="gridcell"] button');
  for (const cell of path) await cells.nth(cell).click();
}

test.describe("F16 — zip competitivo", () => {
  test("oculta la solución, acepta el camino final y reintenta idempotentemente", async ({ page }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.charlie);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: /Une los números/ })).toBeVisible();
    expect(await page.content()).not.toContain("solutionPayload");
    expect(await page.content()).not.toContain('"solution"');

    await page.reload();
    await expect(page.getByRole("heading", { name: /Une los números/ })).toBeVisible();

    const requestBodies: Array<Record<string, unknown>> = [];
    let firstResponse = true;
    await page.route("**/api/competitive/attempts/*/answer", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (!body.answer || typeof body.answer !== "object" || !("path" in body.answer)) {
        await route.continue();
        return;
      }
      requestBodies.push(body);
      if (!firstResponse) {
        await route.continue();
        return;
      }
      firstResponse = false;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "f16-lost-response" } }),
      });
      await response.body();
    });

    await solveZip(page);
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").nth(1).locator("summary").click();
    await expect(page.getByText("El camino serpentea por las cinco filas.").first()).toBeVisible();
  });

  test("el timeout conserva la respuesta parcial", async ({ page }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: /Une los números/ })).toBeVisible();
    await page.locator('[role="gridcell"] button').nth(1).click();
    await expect(page.getByText(/2\/25/)).toBeVisible();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").last().locator("summary").click();
    await expect(page.getByText(/Celdas recorridas/)).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash F16", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva F16/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash F16 Zip" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
