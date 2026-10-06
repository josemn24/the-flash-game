import { loseGameplayConfirmations } from "./support/lost-confirmations";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: {
    alice: FixtureAccount;
    bob: FixtureAccount;
  };
  data: {
    room: { slug: string };
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

test.describe("Fase 2 — Narrative competitivo persistido", () => {
  test("recorre escenas, mezcla respuestas, completa y revisa soluciones solo al final", async ({
    page,
  }) => {
    test.setTimeout(60_000);
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
    await page.getByRole("button", { name: "África" }).click();
    await expect(page.getByRole("heading", { name: "El aire cambia" })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Seguir" }).click();

    await expect(
      page.getByRole("heading", { name: /instrumento registra la temperatura/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Termómetro" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();
    expect(await page.content()).not.toContain("NARRATIVE_PRIVATE");

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
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
    await page.getByRole("button", { name: "Termómetro" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();
  });
});
