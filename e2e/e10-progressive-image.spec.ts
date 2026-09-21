import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: { alice: FixtureAccount; bob: FixtureAccount };
  data: { room: { slug: string }; publicationId: string };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/e10.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva E10/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash E10 Progressive-image" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.describe("E10 — Progressive-image competitivo", () => {
  test("revela desde el timestamp del servidor y conserva el estado al reintentar", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: /monumento aparece/ })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Progreso de revelado" })).toBeVisible();
    await expect(
      page.locator('img[alt="Imagen progresivamente revelada de un monumento europeo"]'),
    ).toBeVisible();

    const deadline = await page.getByRole("timer").getAttribute("aria-label");
    expect(deadline).toMatch(/segundos restantes/);
    await page.getByLabel("¿Qué aparece?").fill("eiffel tower");

    let firstResponse = true;
    const requestBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/competitive/attempts/*/answer", async (route) => {
      requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (!firstResponse) return route.continue();
      firstResponse = false;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e10-lost-response" } }),
      });
      await response.body();
    });
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await expect(page.getByText("Torre Eiffel en París")).toBeVisible();
    await expect(page.getByText(/Imagen revelada al responder/)).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash E10", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva E10/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash E10 Progressive-image" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
