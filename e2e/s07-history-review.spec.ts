import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string; playerId: string };
type Fixture = {
  users: {
    alice: FixtureAccount;
    bob: FixtureAccount;
    carol: FixtureAccount;
    dave: FixtureAccount;
  };
  data: {
    room: { slug: string };
    publicationIds: {
      completed: string;
      abandoned: string;
      empty: string;
      inProgress: string;
      cancelled: string;
      archived: string;
      survival: string;
      pyramid: string;
      alphabet: string;
      narrative: string;
    };
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s07.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

test.describe("S07 — historial y revisión competitiva", () => {
  test("carga historial y revisión persistidos después de refrescar", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const data = await fixture();
    const roomPath = `/salas/${data.data.room.slug}`;
    const historyPath = `${roomPath}/historial`;
    const completedPath = `${historyPath}/${data.data.publicationIds.completed}`;
    const abandonedPath = `${historyPath}/${data.data.publicationIds.abandoned}`;

    await signIn(page, data.users.alice);
    await page.goto(historyPath);
    await expect(page.getByRole("heading", { name: "Historial" })).toBeVisible();
    await expect(page.getByText("Flash histórico S07")).toHaveCount(4);
    await expect(page.getByText("3 jugadores")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver ranking" })).toHaveCount(8);
    await expect(page.getByText(data.data.publicationIds.inProgress)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("link", { name: "Ver ranking" })).toHaveCount(8);

    const alphabetPath = `${historyPath}/${data.data.publicationIds.alphabet}`;
    await page.locator(`a[href="${alphabetPath}"]`).click();
    await expect(page.getByRole("heading", { name: "Alfabeto histórico S07" })).toBeVisible();
    await page.getByRole("link", { name: /Ver detalle de Carol/ }).click();
    await expect(page.getByText("Resultado Alfabeto", { exact: true })).toBeVisible();
    await expect(page.getByText("1 de 4 letras acertadas", { exact: true })).toBeVisible();
    await expect(page.locator("details")).toHaveCount(4);
    await expect(page.getByText("Sin responder", { exact: true })).toHaveCount(2);
    for (const [index, letter] of ["B", "A", "Ñ", "Z"].entries()) {
      const entry = page.locator("details").nth(index);
      await expect(entry.locator("summary").getByText(letter, { exact: true })).toBeVisible();
      await entry.locator("summary").click();
      await expect(entry.getByText("Lovelace", { exact: true }).last()).toBeVisible();
      await expect(
        entry.getByText(`S07_ALPHABET_EXPLANATION_${index}`, { exact: true }),
      ).toBeVisible();
    }
    await page.reload();
    await expect(page.getByText("1 de 4 letras acertadas", { exact: true })).toBeVisible();
    await expect(page.locator("details")).toHaveCount(4);
    await page.goto(`${alphabetPath}/${data.users.alice.playerId}`);
    await expect(page.getByText("Partida abandonada")).toBeVisible();
    await expect(page.getByText("Sin responder", { exact: true })).toHaveCount(4);

    await page.goto(`${historyPath}/${data.data.publicationIds.survival}`);
    await expect(page.getByRole("heading", { name: "Ranking del desafío" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Supervivencia histórica S07" })).toBeVisible();

    await page.goto(`${historyPath}/${data.data.publicationIds.pyramid}`);
    await expect(page.getByRole("heading", { name: "Ranking del desafío" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pirámide histórica S07" })).toBeVisible();

    await page.goto(completedPath);
    await expect(page.getByRole("heading", { name: "Ranking del desafío" })).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Carol")).toBeVisible();
    await expect(page.getByText("Dave")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver detalle de Alice/ })).toBeVisible();

    await page.getByRole("link", { name: /Ver detalle de Alice/ }).click();
    await expect(page.getByRole("heading", { name: "Alice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Respuestas" })).toBeVisible();
    await page.locator("details").first().locator("summary").click();
    await expect(page.getByText("Respuesta correcta").first()).toBeVisible();
    await expect(page.getByText("Partida abandonada")).toHaveCount(0);

    await page.goto(`${abandonedPath}/${data.users.carol.playerId}`);
    await expect(page.getByRole("heading", { name: "Carol" })).toBeVisible();
    await expect(page.getByText("Partida abandonada")).toBeVisible();
    await expect(page.getByText("Sin responder", { exact: true })).toBeVisible();
    await page.locator("details").first().locator("summary").click();
    await expect(page.getByText("Respuesta correcta").first()).toBeVisible();

    const spectatorContext = await browser.newContext();
    const spectatorPage = await spectatorContext.newPage();
    try {
      await signIn(spectatorPage, data.users.bob);
      await spectatorPage.goto(completedPath);
      await expect(spectatorPage.getByText("Alice")).toBeVisible();
      await expect(spectatorPage.getByRole("link", { name: /Ver detalle de/ })).toHaveCount(0);
      await spectatorPage.goto(alphabetPath);
      await expect(
        spectatorPage.getByRole("heading", { name: "Alfabeto histórico S07" }),
      ).toBeVisible();
      await expect(spectatorPage.getByRole("link", { name: /Ver detalle de/ })).toHaveCount(0);
      await spectatorPage.goto(`${alphabetPath}/${data.users.carol.playerId}`);
      await expect(spectatorPage.getByText("Error 404")).toBeVisible();
      await spectatorPage.goto(`${completedPath}/${data.users.alice.playerId}`);
      await expect(spectatorPage.getByText("Error 404")).toBeVisible();
      await expect(
        spectatorPage.getByRole("heading", { name: "Ruta fuera de pista" }),
      ).toBeVisible();
    } finally {
      await spectatorContext.close();
    }

    await page.goto(`${historyPath}/not-a-uuid/${data.users.alice.playerId}`);
    await expect(page.getByText("Error 404")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ruta fuera de pista" })).toBeVisible();
  });
});
