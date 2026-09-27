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
  test("resuelve localmente y comprueba el mapa completo con idempotencia", async ({ page }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: "Relaciona cada concepto" })).toBeVisible();
    expect(await page.content()).not.toContain("correctMatchId");
    await expect(page.getByText("0/3")).toBeVisible();

    const requestBodies: Array<Record<string, unknown>> = [];
    const answerRequests: Promise<unknown>[] = [];
    await page.route("**/api/competitive/attempts/*/answer", async (route) => {
      requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      answerRequests.push(Promise.resolve());
      if (requestBodies.length === 1) {
        const response = await route.fetch();
        await route.fulfill({
          status: 503,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            error: { code: "command_failed", requestId: "e04-lost-response" },
          }),
        });
        await response.body();
        return;
      }
      await route.continue();
    });

    await choose(page, "Uno", "Primero");
    await page.getByRole("button", { name: /^Uno, asociación 1 con Primero/ }).click();
    await page.getByRole("button", { name: "Segundo", exact: true }).click();
    await expect(page.locator('button[data-pair-number="1"][data-pair-tone="violet"]')).toHaveCount(
      2,
    );
    await page.getByRole("button", { name: /^Uno, asociación 1 con Segundo/ }).click();
    await page.getByRole("button", { name: "Primero", exact: true }).click();
    await choose(page, "Dos", "Segundo");
    await choose(page, "Tres", "Tercero");
    expect(requestBodies).toHaveLength(0);
    await expect(page.locator('button[data-pair-state="pending"]')).toHaveCount(6);
    await expect(page.locator('button[data-pair-state="pending"] svg')).toHaveCount(0);
    await expect(page.locator('button[data-pair-number="1"][data-pair-tone="violet"]')).toHaveCount(
      2,
    );
    await expect(page.locator('button[data-pair-number="2"][data-pair-tone="blue"]')).toHaveCount(
      2,
    );
    await expect(page.locator('button[data-pair-number="3"][data-pair-tone="amber"]')).toHaveCount(
      2,
    );
    await expect(page.getByLabel("Asociaciones pendientes de comprobación")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Comprobar parejas" })).toBeEnabled();

    await page.getByRole("button", { name: "Comprobar parejas" }).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    expect(requestBodies[0]?.answer).toEqual({ l1: "r1", l2: "r2", l3: "r3" });
    await Promise.all(answerRequests);
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
