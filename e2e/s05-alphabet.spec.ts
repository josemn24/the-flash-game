import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
type Account = { email: string; password: string };
async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s05.json", "utf8")) as {
    users: Record<string, Account>;
  };
}
async function open(page: Page, account: Account) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: /Abrir sala Sala s05/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}
async function answer(page: Page, value: string) {
  await page.getByLabel("Tu respuesta").fill(value);
  await page.getByRole("button", { name: "Responder", exact: true }).click();
}

test("Alfabeto conserva pases y vueltas tras recargar y completa el resultado", async ({
  page,
}) => {
  await open(page, (await fixture()).users.alice);
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible();
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
  await page.reload();
  // Recover closes the open letter as a pass under the existing server rules.
  await expect(page.getByRole("heading", { name: "Capital de Australia" })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "B: Pasada" })).toBeVisible();
  await answer(page, "Canberra");
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible();
  await answer(page, "armadillo");
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
  await answer(page, "Brasil");
  await expect(page.getByText("Desafío completado")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Desafío completado")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(3);
});

test("Alfabeto cierra una vez cada letra pendiente tras el deadline global", async ({ page }) => {
  test.setTimeout(60000);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/answer", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.continue();
  });
  await open(page, (await fixture()).users.bob);
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible();
  await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 35000 });
  expect(bodies).toHaveLength(3);
  expect(new Set(bodies.map((body) => body.challengeItemId)).size).toBe(3);
  await page.reload();
  await expect(page.getByText("Desafío completado")).toBeVisible();
});

test("Alfabeto reintenta preparación y verifica un cierre cuya respuesta se perdió", async ({
  page,
}) => {
  test.setTimeout(60000);
  let failPrepare = true;
  const preparationBodies: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/prepare", async (route) => {
    preparationBodies.push(route.request().postDataJSON());
    if (!failPrepare) {
      await route.continue();
      return;
    }
    failPrepare = false;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await open(page, (await fixture()).users.carol);
  await page.getByRole("button", { name: "Reintentar partida" }).click();
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible();
  expect(preparationBodies[1]).toEqual(preparationBodies[0]);
  let loseComplete = true;
  const completionBodies: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/complete", async (route) => {
    completionBodies.push(route.request().postDataJSON());
    if (!loseComplete) {
      await route.continue();
      return;
    }
    loseComplete = false;
    const response = await route.fetch();
    // Forward Set-Cookie from the accepted completion but lose the response body.
    await route.fulfill({
      response,
      status: 503,
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await answer(page, "armadillo");
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
  await answer(page, "Brasil");
  await expect(page.getByRole("heading", { name: "Capital de Australia" })).toBeVisible();
  await answer(page, "Canberra");
  await page.getByRole("button", { name: "Reintentar partida" }).click();
  await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20000 });
  expect(completionBodies[1]).toEqual(completionBodies[0]);
});
