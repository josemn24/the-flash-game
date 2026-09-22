import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = { users: { alice: FixtureAccount; charlie: FixtureAccount; bob: FixtureAccount } };

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/f19.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva F19/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash F19 Word-hashtag" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

async function startWordHashtag(page: Page) {
  await page.getByRole("button", { name: "Lisboa" }).click();
  await expect(page.getByRole("heading", { name: /Intercambia las letras/ })).toBeVisible();
  await expect(page.locator('[data-word-hashtag-cell="1"]')).toBeEnabled();
}

async function swap(page: Page, fromCell: number, toCell: number) {
  const from = page.locator(`[data-word-hashtag-cell="${fromCell}"]`);
  const to = page.locator(`[data-word-hashtag-cell="${toCell}"]`);
  await expect(from).toBeEnabled();
  await from.click();
  await expect(from).toHaveAttribute("aria-selected", "true");
  await expect(to).toBeEnabled();
  await to.click();
}

test.describe("F19 — word-hashtag competitivo", () => {
  test("mantiene la solución privada y reintenta un swap con la misma idempotency key", async ({ page }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.charlie);
    await startWordHashtag(page);
    expect(await page.content()).not.toContain("words");
    expect(await page.content()).not.toContain("solutionPayload");

    const requestBodies: Array<Record<string, unknown>> = [];
    let firstResponse = true;
    await page.route("**/api/competitive/attempts/*/word-hashtag/swap", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requestBodies.push(body);
      if (!firstResponse) {
        await route.continue();
        return;
      }
      firstResponse = false;
      const response = await route.fetch();
      await response.body();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "f19-lost-response" } }),
      });
    });

    await swap(page, 1, 7);
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await swap(page, 5, 13);
    await swap(page, 16, 19);
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").last().locator("summary").click();
    await expect(page.locator('[aria-label="Solución del Hashtag de palabras"]')).toBeVisible();
  });

  test("rechaza un swap inválido sin consumirlo y conserva el draft al hacer timeout", async ({ page }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);
    await startWordHashtag(page);
    await swap(page, 3, 8);
    await expect(page.getByText("Ese intercambio no está permitido.")).toBeVisible();
    await swap(page, 1, 7);
    await expect(page.getByText(/movimientos usados/)).toBeVisible();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").last().locator("summary").click();
    await expect(page.getByText(/Movimientos/)).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash F19", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva F19/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash F19 Word-hashtag" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
