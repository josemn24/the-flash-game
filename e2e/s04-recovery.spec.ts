import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: {
    alice: FixtureAccount;
    bob: FixtureAccount;
    carol: FixtureAccount;
  };
  data: {
    room: { slug: string };
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s04.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva S04/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash recuperación S04" })).toBeVisible();
  await page.getByRole("link", { name: "Empezar desafío" }).click();
}

async function startQuestion(page: Page) {
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
}

test.describe("S04 — recuperación y abandono de Flash", () => {
  test("recupera el intento tras recargar y conserva la revisión terminal", async ({ page }) => {
    test.setTimeout(60_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);
    await startQuestion(page);
    expect(await page.content()).not.toContain("S04_EXPLANATION");

    await page.reload();
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Marte" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").nth(1).locator("summary").click();
    await expect(
      page.getByText("S04_EXPLANATION_TWO: Marte recibe el nombre de planeta rojo."),
    ).toBeVisible();
  });

  test("bloquea una segunda sesión y permite abandonar el intento", async ({ page, browser }) => {
    test.setTimeout(60_000);
    const data = await fixture();
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();

    try {
      await openFlash(page, data.users.carol);
      await startQuestion(page);
      await signIn(secondPage, data.users.carol);

      const blocked = await secondPage.evaluate(async (scheduledChallengeId) => {
        const response = await fetch("/api/competitive/attempts/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scheduledChallengeId,
            idempotencyKey: "s04-second-device-start",
          }),
        });
        return { status: response.status, body: await response.json() };
      }, data.data.publicationId);

      expect(blocked.status).toBe(409);
      expect(blocked.body).toEqual({ error: { code: "attempt_control_required" } });

      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: "Abandonar intento" }).click();
      await expect(page.getByRole("heading", { name: "Intento no completado" })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Intento no completado" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
    } finally {
      await secondContext.close();
    }
  });

  test("mantiene al spectator fuera del competitivo", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva S04/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash recuperación S04" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
    expect(await page.content()).not.toContain("S04_EXPLANATION");
  });
});
