import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("Narrative persiste Queens, revela pistas y recupera el cursor interactivo", async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = JSON.parse(await readFile("output/fixtures/narrative-interactive.json", "utf8"));
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(data.users.alice.email);
  await page.getByLabel("Contraseña").fill(data.users.alice.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: /Abrir sala Sala narrative-interactive/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  const board = page.getByRole("grid", { name: "Tablero Queens de 4 por 4" });
  await expect(board).toBeVisible();
  const draft = page.waitForResponse((response) => response.url().endsWith("/queens/draft"));
  await board.getByRole("gridcell", { name: /Fila 2, columna 1/ }).click();
  await draft;
  await page.reload();
  await expect(page.getByText("2/4 coronas")).toBeVisible();
  await board.getByRole("gridcell", { name: /Fila 3, columna 4/ }).click();
  await board.getByRole("gridcell", { name: /Fila 4, columna 2/ }).click();
  await expect(page.getByRole("heading", { name: "El segundo sello" })).toBeVisible();
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(
    page.getByRole("heading", { name: "Identifica el acontecimiento del archivo" }),
  ).toBeVisible();
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/progressive-clues/reveal", async (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length > 1) {
      await route.continue();
      return;
    }
    await route.fetch();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await page.getByRole("button", { name: /Revelar otra pista/ }).click();
  await page.getByRole("button", { name: "Reintentar revelación" }).click();
  await expect(page.getByText("2 de 3 pistas")).toBeVisible();
  expect(bodies[1]).toEqual(bodies[0]);
  await page.reload();
  await expect(page.getByText("2 de 3 pistas")).toBeVisible();
  await page.getByLabel("Escribe tu respuesta").fill("muro de berlin");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByText("Desafío completado")).toBeVisible();
});

test("Narrative reintenta preparación y una respuesta aceptada sin duplicarla", async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = JSON.parse(await readFile("output/fixtures/narrative-interactive.json", "utf8"));
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(data.users.bob.email);
  await page.getByLabel("Contraseña").fill(data.users.bob.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: /Abrir sala Sala narrative-interactive/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  const board = page.getByRole("grid", { name: "Tablero Queens de 4 por 4" });
  await board.getByRole("gridcell", { name: /Fila 2, columna 1/ }).click();
  await board.getByRole("gridcell", { name: /Fila 3, columna 4/ }).click();
  await board.getByRole("gridcell", { name: /Fila 4, columna 2/ }).click();
  await expect(page.getByRole("heading", { name: "El segundo sello" })).toBeVisible();
  const preparations: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/prepare", async (route) => {
    preparations.push(route.request().postDataJSON());
    if (preparations.length > 1) {
      await route.continue();
      return;
    }
    const prepared = await route.fetch();
    expect(prepared.status()).toBe(200);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Reintentar partida" }).click();
  await expect(
    page.getByRole("heading", { name: "Identifica el acontecimiento del archivo" }),
  ).toBeVisible();
  expect(preparations[1]).toEqual(preparations[0]);
  const answers: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/answer", async (route) => {
    answers.push(route.request().postDataJSON());
    if (answers.length > 1) {
      await route.continue();
      return;
    }
    await route.fetch();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await page.getByLabel("Escribe tu respuesta").fill("muro de berlin");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByText("Desafío completado")).toBeVisible();
  expect(answers[1]).toEqual(answers[0]);
  await page.reload();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(2);
});
