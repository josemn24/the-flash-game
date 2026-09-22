import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: {
    alice: FixtureAccount;
    bob: FixtureAccount;
    carol: FixtureAccount;
    dave: FixtureAccount;
  };
  data: {
    room: { slug: string };
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s06.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva S06/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash competitivo" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
}

async function completeFlash(page: Page, account: FixtureAccount, perfect: boolean) {
  await openFlash(page, account);
  await page.getByRole("button", { name: perfect ? "Lisboa" : "Oporto" }).click();
  await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
  await page.getByRole("button", { name: "Marte" }).click();
  await expect(page.getByText("Desafío completado")).toBeVisible();
  await expect(page.getByText(/\/100 puntos/)).toBeVisible();
}

test.describe("S06 — dos rankings reales", () => {
  test("persiste ambos rankings, calcula la posición y mantiene filas reales no interactivas", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    const carolContext = await browser.newContext();
    const carolPage = await carolContext.newPage();
    const spectatorContext = await browser.newContext();
    const spectatorPage = await spectatorContext.newPage();

    try {
      await completeFlash(page, data.users.alice, true);
      await completeFlash(carolPage, data.users.carol, false);

      const roomPath = `/salas/${data.data.room.slug}`;
      const rankingPath = `${roomPath}/ranking`;

      await page.goto(roomPath);
      await expect(page.getByText("Ranking de hoy")).toBeVisible();
      await expect(page.getByText("Alice")).toBeVisible();
      await expect(page.getByText("Carol")).toBeVisible();
      await expect(page.getByText("1 pendiente por jugar")).toBeVisible();
      await expect(page.getByRole("link", { name: /Ver detalle de/ })).toHaveCount(0);

      await page.goto(rankingPath);
      await expect(page.getByRole("heading", { name: "Ranking global" })).toBeVisible();
      await expect(page.getByText("Alice")).toBeVisible();
      await expect(page.getByText("Carol")).toBeVisible();
      await expect(page.getByText("Dave")).toBeVisible();
      await expect(page.getByText("Bob")).toHaveCount(0);

      await page.reload();
      await expect(page.getByText("Alice")).toBeVisible();
      await expect(page.getByText("Carol")).toBeVisible();

      await page.goto("/");
      const roomCard = page.getByRole("link", { name: /Abrir sala Sala competitiva S06/ });
      await expect(roomCard).toContainText("#1");

      await signIn(spectatorPage, data.users.bob);
      await spectatorPage.goto(roomPath);
      await expect(spectatorPage.getByRole("link", { name: "Jugar" })).toHaveCount(0);
      await expect(spectatorPage.getByText("Ranking de hoy")).toBeVisible();
      await spectatorPage.goto(rankingPath);
      await expect(spectatorPage.getByText("Alice")).toBeVisible();
      await expect(spectatorPage.getByText("Carol")).toBeVisible();
      await expect(spectatorPage.getByText("Dave")).toBeVisible();
      await expect(spectatorPage.getByText("Bob")).toHaveCount(0);
    } finally {
      await carolContext.close();
      await spectatorContext.close();
    }
  });
});
