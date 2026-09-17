import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: { alice: FixtureAccount; bob: FixtureAccount };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/e02.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva E02/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash E02 Logic-code" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.describe("E02 — Logic-code competitivo", () => {
  test("conserva códigos, rechaza duplicados y resuelve con ceros iniciales", async ({ page }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: "Descubre el código" })).toBeVisible();
    expect(await page.content()).not.toContain("0420");
    expect(await page.getByText("1203")).toBeVisible();

    await page.getByLabel("Cifra 1 de 4").fill("0000");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText("Código incorrecto. Prueba otra combinación.")).toBeVisible();
    await expect(page.getByText("1 intento incorrecto")).toBeVisible();
    await expect(page.getByText("0000")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Descubre el código" })).toBeVisible();
    await expect(page.getByText("0000")).toBeVisible();

    await page.getByLabel("Cifra 1 de 4").fill("0000");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(
      page.getByText("Ya has probado ese código. El intento no se ha consumido."),
    ).toBeVisible();
    await expect(page.getByText("1 intento incorrecto")).toBeVisible();

    let firstResponse = true;
    await page.route("**/api/competitive/attempts/*/logic-code/attempt", async (route) => {
      if (!firstResponse) {
        await route.continue();
        return;
      }
      firstResponse = false;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e02-lost-response" } }),
      });
      await response.body();
    });

    await page.getByLabel("Cifra 1 de 4").fill("0420");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").filter({ hasText: "Código lógico" }).locator("summary").click();
    await expect(page.getByText("La secuencia satisface las pistas.")).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash E02", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva E02/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash E02 Logic-code" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
