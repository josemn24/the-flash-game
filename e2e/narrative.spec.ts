import { loseGameplayConfirmations } from "./support/lost-confirmations";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: {
    alice: FixtureAccount;
    bob: FixtureAccount;
    superadmin: FixtureAccount;
  };
  data: {
    room: { id: string; slug: string };
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/narrative.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openNarrative(page: Page, account: FixtureAccount) {
  await signIn(page, account);
  await page.getByRole("link", { name: /Abrir sala Sala Narrative/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "La señal bajo el hielo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.use({ actionTimeout: 15_000 });

test.describe("Fase 2 — Narrative competitivo persistido", () => {
  test("completa Narrativa, permite confirmar su borrado y vuelve a empezar desde cero", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const verifyConfirmations = await loseGameplayConfirmations(page);
    const data = await fixture();
    await openNarrative(page, data.users.alice);

    await expect(page.getByRole("heading", { name: "La señal bajo el hielo" })).toBeVisible();
    expect(await page.content()).not.toContain("NARRATIVE_PRIVATE");
    await page.getByRole("button", { name: "Seguir" }).click();
    await expect(page.getByRole("heading", { name: "Una coordenada imposible" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir" }).click();

    await expect(page.getByRole("heading", { name: /continente rodea el Polo Sur/ })).toBeVisible();
    expect(await page.content()).not.toContain("NARRATIVE_PRIVATE");
    await page.getByRole("button", { name: "Antártida" }).click();
    await expect(page.getByRole("heading", { name: "El aire cambia" })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Seguir" }).click();

    await expect(
      page.getByRole("heading", { name: /instrumento registra la temperatura/ }),
    ).toBeVisible();
    await page.getByLabel("Escribe tu respuesta").fill("Termómetro");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
    await expect(page.locator("#challenge-result-title")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();
    expect(await page.content()).not.toContain("NARRATIVE_PRIVATE");

    await page.reload();
    await expect(page.locator("#challenge-result-title")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").first().locator("summary").click();
    await expect(
      page.getByText("NARRATIVE_PRIVATE_ONE: La Antártida rodea el Polo Sur."),
    ).toBeVisible();
    await page.locator("details").nth(1).locator("summary").click();
    await expect(
      page.getByText("NARRATIVE_PRIVATE_TWO: El termómetro registra la temperatura."),
    ).toBeVisible();
    await verifyConfirmations();

    const adminContext = await browser.newContext();
    try {
      const admin = await adminContext.newPage();
      await signIn(admin, data.users.superadmin);
      const publications = `/admin/rooms/${data.data.room.id}/attempts`;
      await admin.goto(publications);
      await expect(admin.getByRole("heading", { name: "La señal bajo el hielo" })).toBeVisible();
      await admin.locator(`a[href="${publications}/${data.data.publicationId}"]`).click();
      const inspection = admin.getByRole("link", { name: "Inspeccionar" });
      const inspectionPath = await inspection.getAttribute("href");
      expect(inspectionPath).toMatch(/\/attempts\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/);
      const oldAttemptUrl = new URL(inspectionPath!, admin.url());
      const oldAttemptId = oldAttemptUrl.pathname.split("/").at(-1);
      await inspection.click();
      await admin.getByRole("button", { name: "Eliminar intento" }).click();
      const confirmation = admin.getByRole("dialog", { name: "Eliminar intento" });
      await expect(confirmation).toContainText("Alice");
      await expect(confirmation).toContainText("Sala Narrative");
      await expect(confirmation).toContainText("La señal bajo el hielo");
      await expect(confirmation.getByRole("button", { name: "Cancelar" })).toBeFocused();
      await confirmation.getByRole("button", { name: "Cancelar" }).click();
      await expect(confirmation).toBeHidden();

      await admin.getByRole("button", { name: "Eliminar intento" }).click();
      await confirmation.getByRole("button", { name: "Eliminar definitivamente" }).click();
      await expect(
        admin.getByRole("status").filter({ hasText: "Intento eliminado." }),
      ).toBeVisible();
      await expect(admin.getByRole("link", { name: "Inspeccionar" })).toHaveCount(0);
      await admin.goto(oldAttemptUrl.href);
      await expect(admin.getByText("Acceso no disponible")).toBeVisible();

      await page.goto(`/salas/${data.data.room.slug}`);
      await page.getByRole("link", { name: "Jugar" }).click();
      const newStart = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/competitive/attempts/start" && response.ok(),
      );
      await page.getByRole("button", { name: "Empezar desafío" }).click();
      expect((await (await newStart).json()).attemptId).not.toBe(oldAttemptId);
      await expect(page.getByRole("heading", { name: "La señal bajo el hielo" })).toBeVisible();
      await page.getByRole("button", { name: "Seguir" }).click();
      await expect(page.getByRole("heading", { name: "Una coordenada imposible" })).toBeVisible();
    } finally {
      await adminContext.close().catch(() => {});
    }
  });

  test("persiste un timeout, recupera la siguiente escena tras recargar y termina", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const data = await fixture();
    await openNarrative(page, data.users.bob);

    await page.getByRole("button", { name: "Seguir" }).click();
    await page.getByRole("button", { name: "Seguir" }).click();
    await expect(page.getByRole("heading", { name: /continente rodea el Polo Sur/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tiempo agotado" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "El aire cambia" })).toBeVisible({
      timeout: 10_000,
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: "El aire cambia" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Seguir" }).click();
    await expect(
      page.getByRole("heading", { name: /instrumento registra la temperatura/ }),
    ).toBeVisible();
    await page.getByLabel("Escribe tu respuesta").fill("Termómetro");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
    await expect(page.locator("#challenge-result-title")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();
  });
});
