import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: { alice: FixtureAccount; bob: FixtureAccount };
  data: { room: { slug: string } };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/e04.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva E04/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash E04 Matching" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

async function choose(page: Page, left: string, right: string) {
  await page.getByRole("button", { name: left, exact: true }).click();
  await page.getByRole("button", { name: right, exact: true }).click();
}

test.describe("E04 — Matching competitivo", () => {
  test("valida parejas server-side, recupera progreso e idempotencia", async ({ page }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: "Relaciona cada concepto" })).toBeVisible();
    expect(await page.content()).not.toContain("correctMatchId");
    await expect(page.getByText("0 de 3 parejas")).toBeVisible();

    await choose(page, "Uno", "Segundo");
    await expect(page.getByText("No forman una pareja. Puedes volver a intentarlo.")).toBeVisible();
    await expect(page.getByText("1 error")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Relaciona cada concepto" })).toBeVisible();
    await expect(page.getByText("0 de 3 parejas")).toBeVisible();
    await expect(page.getByText("1 error")).toBeVisible();

    let firstResponse = true;
    const requestBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/competitive/attempts/*/matching/pair", async (route) => {
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
        body: JSON.stringify({ error: { code: "command_failed", requestId: "e04-lost-response" } }),
      });
      await response.body();
    });

    await choose(page, "Uno", "Primero");
    await expect(page.getByRole("button", { name: "Reintentar pareja" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar pareja" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByText("1 de 3 parejas")).toBeVisible();

    await choose(page, "Dos", "Segundo");
    await expect(page.getByText("2 de 3 parejas")).toBeVisible();
    await choose(page, "Tres", "Tercero");
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").filter({ hasText: "Emparejar" }).locator("summary").click();
    await expect(page.getByText("Cada concepto tiene su equivalente.")).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash E04", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva E04/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash E04 Matching" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
