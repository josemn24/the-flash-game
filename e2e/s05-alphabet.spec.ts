import { loseGameplayConfirmations } from "./support/lost-confirmations";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql } from "../scripts/support/supabase-local.mjs";
type Account = { email: string; password: string; playerId: string };
async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s05.json", "utf8")) as {
    users: Record<string, Account>;
    data: { timeoutRoom: { slug: string }; timeoutPublicationId: string };
  };
}
async function open(page: Page, account: Account, roomTitle = "Sala s05") {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: new RegExp(`^Abrir sala ${roomTitle}\\.`) }).click();
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
  test.setTimeout(60000);
  const verifyConfirmations = await loseGameplayConfirmations(page);
  await open(page, (await fixture()).users.alice);
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible({
    timeout: 15000,
  });
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
  await verifyConfirmations();
});

test("Alfabeto cierra una vez cada letra pendiente tras el deadline global", async ({ page }) => {
  test.setTimeout(60000);
  const bodies: Record<string, unknown>[] = [];
  const completions: string[] = [];
  await page.route("**/attempts/*/answer", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.continue();
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/complete")) completions.push(request.url());
  });
  await open(page, (await fixture()).users.bob);
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible();
  await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 35000 });
  expect(bodies).toHaveLength(0);
  expect(completions).toHaveLength(1);
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
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible({
    timeout: 15000,
  });
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
  await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20000 });
  expect(completionBodies[1]).toEqual(completionBodies[0]);
});

test("18 letras conservan la respuesta válida y cierran las pendientes con una petición", async ({
  page,
}) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/(answer|complete)$/.test(request.url())) requests.push(request.url());
  });
  const data = await fixture();
  await open(page, data.users.dave, "Sala s05-timeout");
  await expect(page.getByRole("heading", { name: "Pregunta de la letra A" })).toBeVisible();
  await answer(page, "respuesta");
  await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 25000 });
  expect(requests.filter((url) => url.endsWith("/answer"))).toHaveLength(1);
  expect(requests.filter((url) => url.endsWith("/complete"))).toHaveLength(1);
  await expect(page.getByLabel("5 de 100 puntos")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(18);
  await page.reload();
  await expect(page.getByText("Desafío completado")).toBeVisible();
  await expect(page.getByLabel("5 de 100 puntos")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(18);
  await page.goto("/");
  const room = page.getByRole("link", { name: /^Abrir sala Sala s05-timeout\./ });
  await expect(room.getByRole("img", { name: "5 Flash Points" })).toBeVisible();
});

test("recargar tras el deadline cierra 18 letras sin respuestas automáticas", async ({ page }) => {
  test.setTimeout(45000);
  const data = await fixture();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/answer")) requests.push(request.url());
  });
  const started = page.waitForResponse((response) => response.url().endsWith("/start"));
  await open(page, data.users.bob, "Sala s05-timeout");
  const { deadlineAt } = (await (await started).json()) as { deadlineAt: string };
  const gameUrl = page.url();
  await expect(page.getByRole("heading", { name: "Pregunta de la letra A" })).toBeVisible();
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta de la letra B" })).toBeVisible();
  await page.goto("/");
  await expect.poll(() => Date.now(), { timeout: 12000 }).toBeGreaterThan(Date.parse(deadlineAt));
  let loseRecovery = true;
  const recoveries: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/recover", async (route) => {
    recoveries.push(route.request().postDataJSON());
    if (!loseRecovery) return route.continue();
    loseRecovery = false;
    const response = await route.fetch();
    await route.fulfill({
      response,
      status: 503,
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await page.goto(gameUrl);
  await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 15000 });
  expect(recoveries).toHaveLength(2);
  expect(recoveries[1]).toEqual(recoveries[0]);
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(18);
  // Close only this isolated fixture publication to exercise the historical projection.
  await dockerSql(`update public.scheduled_challenges set status = 'closed'
    where id = '${data.data.timeoutPublicationId}'::uuid;`);
  await page.goto(
    `/salas/${data.data.timeoutRoom.slug}/historial/${data.data.timeoutPublicationId}/${data.users.bob.playerId}`,
  );
  await expect(page.getByText("0 de 18 letras acertadas", { exact: true })).toBeVisible();
  await expect(page.locator("details")).toHaveCount(18);
  await page.reload();
  await expect(page.getByText("0 de 18 letras acertadas", { exact: true })).toBeVisible();
  await expect(page.getByText("Sin responder", { exact: true })).toHaveCount(18);
});
