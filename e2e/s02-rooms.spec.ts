import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type Fixture = {
  users: {
    alice: { email: string; password: string };
    bob: { email: string; password: string };
  };
  data: {
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s02.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

test.describe("S02 — salas e introducción autorizada", () => {
  test("Alice solo ve sus salas y recibe una introducción segura", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.alice);

    await expect(page.getByRole("link", { name: /Abrir sala Sala principal/ })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Abrir sala Sala sin temporada/ })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Abrir sala Sala de espectador/ })).toHaveCount(1);
    await expect(page.getByText("Sala externa")).toHaveCount(0);
    await expect(page.getByText("Sala abandonada")).toHaveCount(0);

    await page.getByRole("link", { name: /Abrir sala Sala principal/ }).click();
    await expect(page.getByRole("link", { name: /Ver historial de Sala principal/ })).toBeVisible();
    await page.getByRole("link", { name: "Jugar" }).click();
    await expect(page.getByRole("heading", { name: "Metadatos privados S02" })).toBeVisible();
    // S02 deliberately uses short-text content. Pilot competitive gameplay is
    // restricted to the persisted multiple-choice Flash slice, so the safe
    // introduction must not offer a bypass CTA for unsupported content.
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
    const introductionResponse = await page.reload();
    const introductionHtml = (await introductionResponse?.text()) ?? "";
    expect(introductionHtml).not.toContain("S02_PRIVATE_PROMPT");
    expect(introductionHtml).not.toContain("S02_PRIVATE_SOLUTION");
    expect(await page.content()).not.toContain("S02_PRIVATE");

    const unauthorized = await page.goto("/salas/s02-other");
    const missing = await page.goto("/salas/s02-missing");
    expect(unauthorized?.status()).toBe(404);
    expect(missing?.status()).toBe(404);

    const persistedRanking = await page.goto("/salas/s02-main/ranking");
    expect(persistedRanking?.status()).toBe(200);
  });

  test("Bob puede consultar la introducción como spectator sin CTA competitivo", async ({
    page,
  }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);

    await expect(page.getByRole("link", { name: /Abrir sala Sala de espectador/ })).toHaveCount(1);
    await page.getByRole("link", { name: /Abrir sala Sala de espectador/ }).click();
    await expect(page.getByRole("link", { name: "Ver introducción" })).toBeVisible();
    await page.getByRole("link", { name: "Ver introducción" }).click();

    await expect(page.getByRole("heading", { name: "Metadatos privados S02" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
    expect(await page.content()).not.toContain("S02_PRIVATE");
  });
});
