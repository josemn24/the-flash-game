import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: { alice: FixtureAccount; bob: FixtureAccount };
  data: { room: { slug: string }; publicationId: string };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/e01.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva E01/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash E01 Mini-Wordle" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.describe("E01 — Mini-Wordle competitivo", () => {
  test("mantiene progreso, rechaza entradas sin consumir intentos y resuelve con reintento idempotente", async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: "Descubre el personaje bíblico" })).toBeVisible();
    expect(await page.content()).not.toContain("JESUS");
    expect(await page.content()).not.toContain("dictionaryId");

    const input = page.getByLabel("Escribe tu intento");
    await input.fill("ZZZZZ");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Esta palabra no está disponible para este desafío.")).toBeVisible();
    await expect(page.getByText("Intento 1 de 4")).toBeVisible();

    await input.fill("JOSUE");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByLabel(/Intento 1: JOSUE/)).toBeVisible();
    await expect(page.getByText("Intento 2 de 4")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Descubre el personaje bíblico" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel(/Intento 1: JOSUE/)).toBeVisible();

    await input.fill("JOSUE");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Ya has probado esa palabra. El intento no se ha consumido.")).toBeVisible();
    await expect(page.getByText("Intento 2 de 4")).toBeVisible();

    await input.fill("SALON");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByLabel(/Intento 2: SALON/)).toBeVisible();
    await expect(page.getByText("Intento 3 de 4")).toBeVisible();

    let firstResponse = true;
    await page.route("**/api/competitive/attempts/*/mini-wordle/guess", async (route) => {
      if (!firstResponse) {
        await route.continue();
        return;
      }
      firstResponse = false;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e01-lost-response" } }),
      });
      await response.body();
    });

    await input.fill("JESUS");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page
      .locator("details")
      .filter({ hasText: "Mini-Wordle" })
      .locator("summary")
      .click();
    await expect(page.getByText("Jesús es una figura central del cristianismo.")).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash E01", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva E01/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash E01 Mini-Wordle" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
