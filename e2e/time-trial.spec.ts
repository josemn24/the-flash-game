import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function intro(page: Page, player: string) {
  const fixture = JSON.parse(await readFile("output/fixtures/time-trial.json", "utf8"));
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users[player].email);
  await page.getByLabel("Contraseña").fill(fixture.users[player].password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.getByRole("link", { name: /Abrir sala Sala time-trial/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
}
function cell(page: Page, index: number) {
  return page.getByRole("gridcell", {
    name: new RegExp(`Fila ${Math.floor(index / 5) + 1}, columna ${(index % 5) + 1},`),
  });
}
async function start(page: Page, player: string) {
  await intro(page, player);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prueba 1 de 2", { exact: true })).toBeVisible({
    timeout: 15000,
  });
}

test("la intro y cuenta atrás no crean intento; el reloj continúa al cambiar de prueba y se conceden 100 puntos", async ({
  page,
}) => {
  test.setTimeout(90_000);
  let starts = 0;
  const preparations: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/attempts/start")) starts++;
  });
  page.on("response", async (response) => {
    if (response.url().endsWith("/prepare") && response.ok())
      preparations.push(await response.json());
  });
  await intro(page, "alice");
  expect(starts).toBe(0);
  await expect(page.getByRole("gridcell")).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prepárate", { exact: true })).toBeVisible();
  expect(starts).toBe(0);
  await expect(page.getByText("Prueba 1 de 2", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.waitForTimeout(1200);
  // One-second question clocks do not end a Contrarreloj board.
  await expect(cell(page, 10)).toBeEnabled();
  for (const index of [10, 18, 21]) await cell(page, index).click();
  await expect(page.getByText("Prueba 2 de 2", { exact: true })).toBeVisible();
  expect(preparations).toHaveLength(2);
  expect(preparations[1].deadlineAt).toBe(preparations[0].deadlineAt);
  expect(JSON.stringify(preparations)).not.toMatch(/solutionPayload|"solution"/);
  for (const index of [9, 10, 18, 21]) await cell(page, index).click();
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible();
  await expect(page.getByText("2/2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de pruebas" })).toBeVisible();
});

test("móvil: el tercer fallo termina la partida sin puntos ni ventaja por fallar antes", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "bob");
  // The first board has two fixed crowns.
  for (const index of [0, 5, 14]) await cell(page, index).click();
  await expect(page.getByText("2 intentos restantes", { exact: true })).toBeVisible();
  await cell(page, 14).click();
  await cell(page, 20).click();
  await expect(
    page.getByText("1 intento restante · Último intento", { exact: true }),
  ).toBeVisible();
  await cell(page, 20).click();
  await cell(page, 24).click();
  await expect(page.getByRole("heading", { name: "Tu recorrido contrarreloj" })).toBeVisible();
  await expect(page.getByText("Tres validaciones incorrectas", { exact: true })).toBeVisible();
  await expect(page.getByText("Sin aciertos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByText("No alcanzada", { exact: true })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(0);
});

test("teclado y recarga: una prueba activa sin recepción se cierra y no se reentrega", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await start(page, "carol");
  await cell(page, 0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(cell(page, 5)).toBeFocused();
  await page.keyboard.press("x");
  await page.keyboard.press("Space");
  await expect(page.getByText("3 intentos restantes", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tu recorrido contrarreloj" })).toBeVisible();
  await expect(
    page.getByText("Prueba interrumpida sin respuesta recibida", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(0);
});

test("una confirmación de acierto perdida se concilia sin puntuar dos veces", async ({ page }) => {
  test.setTimeout(90_000);
  await start(page, "dave");
  const requests: Array<unknown> = [];
  let discard = true;
  await page.route("**/queens/validate", async (route) => {
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (discard) {
      discard = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "command_failed", requestId: "ct-lost-confirmation" },
        }),
      });
    } else await route.fulfill({ response });
  });
  for (const index of [10, 18, 21]) await cell(page, index).click();
  await expect(
    page.getByRole("button", { name: "Reintentar validación", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reintentar validación", exact: true }).click();
  await expect(page.getByText("Prueba 2 de 2", { exact: true })).toBeVisible();
  expect(requests[1]).toEqual(requests[0]);
  for (const index of [9, 10, 18, 21]) await cell(page, index).click();
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible();
});
