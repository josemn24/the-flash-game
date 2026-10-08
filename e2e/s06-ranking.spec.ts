import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixturePlayer = { email: string; password: string; playerId: string };

type Fixture = {
  users: {
    alice: FixturePlayer;
    bob: FixturePlayer;
    carol: FixturePlayer;
    dave: FixturePlayer;
  };
  data: {
    room: { slug: string };
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s06.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixturePlayer) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openFlash(page: Page, account?: FixturePlayer) {
  if (account) {
    await signIn(page, account);
  } else {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  }
  await page.getByRole("link", { name: /Abrir sala Sala competitiva S06/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash competitivo" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible({
    timeout: 15_000,
  });
}

async function completeFlash(
  page: Page,
  account: FixturePlayer,
  perfect: boolean,
  alreadySignedIn = false,
) {
  await openFlash(page, alreadySignedIn ? undefined : account);
  await page.getByRole("button", { name: perfect ? "Lisboa" : "Oporto" }).click();
  await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
  await page.getByRole("button", { name: "Marte" }).click();
  await expect(page.getByText("Desafío completado")).toBeVisible();
  await expect(page.getByText(/\/100 puntos/)).toBeVisible();
}

test.describe("S06 — dos rankings reales", () => {
  test("persiste ambos rankings y desbloquea la revisión tras completar el desafío", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    const roomPath = `/salas/${data.data.room.slug}`;
    const rankingPath = `${roomPath}/ranking`;
    const carolContext = await browser.newContext();
    const carolPage = await carolContext.newPage();
    const spectatorContext = await browser.newContext();
    const spectatorPage = await spectatorContext.newPage();
    const unplayedContext = await browser.newContext();
    const unplayedPage = await unplayedContext.newPage();

    try {
      await signIn(page, data.users.alice);
      await page.goto(roomPath);
      await expect(page.getByText("Ranking de hoy")).toBeVisible();
      await expect(page.getByRole("link", { name: /Ver detalle de/ })).toHaveCount(0);

      await completeFlash(page, data.users.alice, true, true);
      await completeFlash(carolPage, data.users.carol, false);

      await page.goto(roomPath);
      await expect(page.getByText("Ranking de hoy")).toBeVisible();
      await expect(page.getByText("Alice")).toBeVisible();
      await expect(page.getByText("Carol")).toBeVisible();
      await expect(page.getByText(/\d+ pendientes? por jugar/)).toBeVisible();
      await expect(page.getByRole("link", { name: /Ver detalle de Alice/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Ver detalle de Carol/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Ver detalle de/ })).toHaveCount(2);

      const carolReviewPath = `${roomPath}/ranking/${data.users.carol.playerId}`;
      await page.goto(carolReviewPath);
      await expect(page.getByRole("heading", { name: "Carol" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Respuestas" })).toBeVisible();

      await signIn(unplayedPage, data.users.dave);
      await unplayedPage.goto(roomPath);
      await expect(unplayedPage.getByText("Ranking de hoy")).toBeVisible();
      await expect(unplayedPage.getByRole("link", { name: /Ver detalle de/ })).toHaveCount(0);
      await unplayedPage.goto(carolReviewPath);
      await expect(unplayedPage.getByRole("heading", { name: "Carol" })).toBeVisible();
      await expect(unplayedPage.getByText("Todavía no ha jugado")).toBeVisible();
      await expect(unplayedPage.getByRole("heading", { name: "Respuestas" })).toHaveCount(0);

      await page.goto(rankingPath);
      await expect(page.getByRole("heading", { name: "Ranking de temporada" })).toBeVisible();
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
      await expect(spectatorPage.getByRole("link", { name: /Ver detalle de/ })).toHaveCount(0);
      await spectatorPage.goto(carolReviewPath);
      await expect(spectatorPage.getByText("Error 404")).toBeVisible();
      await expect(
        spectatorPage.getByRole("heading", { name: "Ruta fuera de pista" }),
      ).toBeVisible();
      await spectatorPage.goto(rankingPath);
      await expect(spectatorPage.getByText("Alice")).toBeVisible();
      await expect(spectatorPage.getByText("Carol")).toBeVisible();
      await expect(spectatorPage.getByText("Dave")).toBeVisible();
      await expect(spectatorPage.getByText("Bob")).toHaveCount(0);
    } finally {
      await carolContext.close();
      await spectatorContext.close();
      await unplayedContext.close();
    }
  });
});
