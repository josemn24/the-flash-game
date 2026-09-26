import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: { alice: FixtureAccount; bob: FixtureAccount };
  data: { room: { slug: string }; publicationId: string };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/e03.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva E03/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash E03 Progressive-clues" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.describe("E03 — Progressive-clues competitivo", () => {
  test("revela de forma idempotente, recupera el estado y acepta una variante normalizada", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: "Identifica el acontecimiento" })).toBeVisible();
    await expect(page.getByText("1 de 3 pistas")).toBeVisible();
    await expect(page.getByText("Máximo: 50 pts")).toBeVisible();
    await expect(page.getByText("Ocurrió en Europa.")).toBeVisible();
    await expect(page.getByText("Está relacionado con una caída de muro.")).toHaveCount(0);
    expect(await page.content()).not.toContain("Caída del muro de Berlín");

    let firstResponse = true;
    const requestBodies: Array<Record<string, unknown>> = [];
    await page.route("**/progressive-clues/reveal", async (route) => {
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
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e03-lost-response" } }),
      });
      await response.body();
    });

    await page.getByRole("button", { name: /Revelar otra pista/ }).click();
    await expect(page.getByRole("button", { name: "Reintentar revelación" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar revelación" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByText("2 de 3 pistas")).toBeVisible();
    await expect(page.getByText("Máximo: 37 pts")).toBeVisible();
    await expect(page.getByText("Está relacionado con una caída de muro.")).toBeVisible();
    await expect(page.getByText("Sucedió en 1989.")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Identifica el acontecimiento" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("2 de 3 pistas")).toBeVisible();
    await expect(page.getByText("Está relacionado con una caída de muro.")).toBeVisible();
    await expect(page.getByText("Sucedió en 1989.")).toHaveCount(0);

    await page.getByLabel("Escribe tu respuesta").fill("muro de Berlin");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").filter({ hasText: "Pistas" }).locator("summary").click();
    await expect(page.getByText("Pistas utilizadas")).toBeVisible();
    await expect(page.getByText("2 de 3")).toBeVisible();
    await expect(page.getByText("Caída del muro de Berlín")).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash E03", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva E03/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash E03 Progressive-clues" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
