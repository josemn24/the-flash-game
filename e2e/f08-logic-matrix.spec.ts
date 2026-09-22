import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = { users: { alice: FixtureAccount; bob: FixtureAccount } };

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/f08.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva F08/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash F08 Matrices lógicas" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.describe("F08 — logic-matrix competitivo", () => {
  test("no filtra la solución, persiste respuestas y reintenta idempotentemente", async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: /pieza completa la matriz/ })).toBeVisible();
    expect(await page.content()).not.toContain("correctOptionId");
    await page.reload();
    await expect(page.getByRole("heading", { name: /pieza completa la matriz/ })).toBeVisible();

    await page.getByRole("button", { name: "Opción 2: Pieza A" }).click();
    await expect(page.getByRole("heading", { name: /pieza completa la matriz/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Opción 1: Pieza D" })).toBeEnabled();

    const requestBodies: Array<Record<string, unknown>> = [];
    let firstResponse = true;
    await page.route("**/api/competitive/attempts/*/answer", async (route) => {
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
        body: JSON.stringify({ error: { code: "command_failed", requestId: "f08-lost-response" } }),
      });
      await response.body();
    });

    await page.getByRole("button", { name: "Opción 1: Pieza D" }).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").nth(1).locator("summary").click();
    await expect(page.getByText("La pieza D completa el patrón.").first()).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash F08", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva F08/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash F08 Matrices lógicas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
