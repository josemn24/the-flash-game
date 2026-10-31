import { placeQueensCrown } from "./support/queens";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function startQueens(page: Page, player: "alice" | "bob" | "carol" | "dave") {
  const fixture = JSON.parse(await readFile("output/fixtures/pyramid-queens.json", "utf8"));
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users[player].email);
  await page.getByLabel("Contraseña").fill(fixture.users[player].password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.getByRole("link", { name: /Abrir sala Sala pyramid-queens/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Capital de Portugal 1" })).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("heading", { name: "Briefing 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lisboa" })).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar nivel" }).click();
  await page.getByRole("button", { name: "Lisboa" }).click();
  await expect(page.getByRole("heading", { name: "Briefing 2" })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar nivel" }).click();
  await expect(page.getByRole("heading", { name: "Coloca las cinco coronas" })).toBeVisible();
  await expect(
    page.getByLabel("3 de 3 intentos restantes en este tablero", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Se valida al completar las 5 coronas y dejar de editar un instante.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Progreso de coronas" })).toContainText("1/5");
}

function cell(page: Page, index: number) {
  return page.getByRole("gridcell", {
    name: new RegExp(`Fila ${Math.floor(index / 5) + 1}, columna ${(index % 5) + 1},`),
  });
}

async function wrongBoard(page: Page) {
  for (const index of [0, 5, 14, 20]) await placeQueensCrown(cell(page, index));
  await expect(
    page.getByLabel("2 de 3 intentos restantes en este tablero", { exact: true }),
  ).toBeVisible();
}

test("el tercer fallo termina el ascenso; perder la confirmación no descuenta otro intento", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startQueens(page, "alice");
  const requests: Array<Record<string, unknown>> = [];
  const responses: Array<Record<string, unknown>> = [];
  let releaseFirst!: () => void;
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  await page.route("**/api/competitive/attempts/*/queens/validate", async (route) => {
    requests.push(route.request().postDataJSON());
    const index = requests.length;
    const response = await route.fetch();
    responses.push(await response.json());
    if (index === 1) await firstHeld;
    if (index === 3 || index === 4) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "command_failed", requestId: "pyramid-lost-confirmation" },
        }),
      });
    } else await route.fulfill({ response });
  });
  try {
    for (const index of [0, 5, 14, 20]) await placeQueensCrown(cell(page, index));
    await expect.poll(() => requests.length).toBe(1);
    await expect(cell(page, 20)).toBeDisabled();
    await expect(
      page.getByLabel("3 de 3 intentos restantes en este tablero", { exact: true }),
    ).toBeVisible();
  } finally {
    releaseFirst();
  }
  await expect(
    page.getByLabel("2 de 3 intentos restantes en este tablero", { exact: true }),
  ).toBeVisible();
  await expect(cell(page, 20)).toBeEnabled();
  await cell(page, 20).click();
  await placeQueensCrown(cell(page, 24));
  await expect(
    page.getByLabel("1 de 3 intentos restantes en este tablero", { exact: true }),
  ).toBeVisible();
  await cell(page, 24).click();
  await placeQueensCrown(cell(page, 21));
  await expect(
    page.getByRole("button", { name: "Reintentar validación", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("1 de 3 intentos restantes en este tablero", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reintentar validación", exact: true }).click();
  await expect(
    page.getByText("Has agotado los tres intentos. El ascenso termina en este nivel."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jugar de nuevo", exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(5);
  expect(requests[3]).toEqual(requests[2]);
  expect(requests[4]).toEqual(requests[2]);
  expect(responses[2]).toMatchObject({
    terminal: true,
    incorrectValidations: 3,
    status: "incorrect",
    points: 0,
  });
  expect(responses[3]).toEqual(responses[2]);
  expect(responses[4]).toEqual(responses[2]);
  await expect(page.getByRole("heading", { name: "Briefing 3" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  const review = page.locator("details").filter({ hasText: /^02Nivel 2/ });
  await review.locator("summary").click();
  await expect(review.getByText(/Has agotado los tres intentos/)).toBeVisible();
  // PYR-10: the full seven-level history does not reveal unreached questions.
  await expect(page.locator("details")).toHaveCount(7);
  await expect(page.locator("summary").getByText("No alcanzado", { exact: true })).toHaveCount(5);
  const unreached = page.locator("details").filter({ hasText: /^03Nivel 3/ });
  await unreached.locator("summary").click();
  await expect(
    unreached.getByText("No alcanzado: el ascenso terminó en un nivel anterior."),
  ).toBeVisible();
  await expect(unreached.getByRole("button", { name: "Lisboa" })).toHaveCount(0);
  await expect(unreached.getByText("Capital de Portugal 3", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Jugar de nuevo", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar desafío", exact: true })).toHaveCount(0);
});

for (const [player, failures] of [
  ["bob", 0],
  ["carol", 1],
  ["dave", 2],
] as const) {
  test(`se puede acertar en la oportunidad ${failures + 1}`, async ({ page }) => {
    test.setTimeout(90_000);
    await startQueens(page, player);
    if (failures > 0) {
      await wrongBoard(page);
      if (failures === 2) {
        await cell(page, 20).click();
        await placeQueensCrown(cell(page, 24));
        await expect(
          page.getByLabel("1 de 3 intentos restantes en este tablero", { exact: true }),
        ).toBeVisible();
      }
      for (const index of [0, 5, 14, failures === 2 ? 24 : 20]) await cell(page, index).click();
    }
    const response = page.waitForResponse(
      (response) => response.url().includes("/queens/validate") && response.ok(),
    );
    for (const index of [9, 10, 18, 21]) await placeQueensCrown(cell(page, index));
    const result = await (await response).json();
    expect(result).toMatchObject({
      correct: true,
      terminal: true,
      status: "correct",
      incorrectValidations: failures,
    });
    expect(result.points).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "Briefing 3" })).toBeVisible();
    await expect(page.getByText(/Has agotado los tres intentos/)).toHaveCount(0);
  });
}
