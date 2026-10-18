import { expect, test, type Page } from "@playwright/test";
import { timeTrialConnectPairsQuestions } from "../data/mock/timeTrialFixtures.mjs";

const queensPath = "/demo/flash-pop/desafios/tabarnia-time-trial-queens-01";
const connectPairsPath = "/demo/flash-pop/desafios/tabarnia-time-trial-connect-pairs-01";
const backendPath = /\/auth\/v1(?:\/|$)|\/storage\/v1(?:\/|$)|\/api\/competitive(?:\/|$)/i;

async function finishCountdown(page: Page) {
  await expect(page.locator('main [role="status"] strong').last()).toHaveText("3");
  for (const count of ["2", "1"]) {
    await page.clock.runFor(1_000);
    await expect(page.locator('main [role="status"] strong').last()).toHaveText(count);
  }
  await page.clock.runFor(1_000);
  await page.waitForTimeout(25);
}

function queensCell(page: Page, index: number) {
  return page.getByRole("gridcell", {
    name: new RegExp(`Fila ${Math.floor(index / 5) + 1}, columna ${(index % 5) + 1},`),
  });
}

async function solveQueens(page: Page, questionIndex: number) {
  for (const index of questionIndex === 0 ? [10, 18, 21] : [9, 10, 18, 21])
    await queensCell(page, index).click();
}

function connectPairsCell(page: Page, questionIndex: number, index: number) {
  const size = timeTrialConnectPairsQuestions[questionIndex]!.publicPayload.grid.rows;
  return page.getByRole("button", {
    name: new RegExp(
      `^Fila ${Math.floor(index / size) + 1}, columna ${(index % size) + 1}(?:[:,]|$)`,
    ),
  });
}

async function solveConnectPairs(page: Page, questionIndex: number) {
  const paths = timeTrialConnectPairsQuestions[questionIndex]!.solution.paths;
  for (const path of Object.values(paths))
    for (const cell of path) await connectPairsCell(page, questionIndex, cell).click();
}

test("local Queens Time Trial shares the competitive view, can be reviewed and replayed without backend calls", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (backendPath.test(new URL(request.url()).pathname)) backendRequests.push(request.url());
  });

  await page.goto("/demo/flash-pop");
  await expect(page.getByRole("link", { name: "Ensayar Queens" })).toHaveAttribute(
    "href",
    queensPath,
  );
  await page.goto(queensPath);
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prepárate", { exact: true })).toBeVisible();
  await finishCountdown(page);

  await expect(page.getByRole("heading", { name: "Queens" })).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.clock.runFor(1_500);
  await expect(queensCell(page, 10)).toBeEnabled();
  await solveQueens(page, 0);
  await expect(page.getByText("Prueba 2 de 2", { exact: true })).toBeVisible();
  await solveQueens(page, 1);
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("2/2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Volver al resultado" }).click();
  await page.getByRole("button", { name: "Repetir ensayo" }).click();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prepárate", { exact: true })).toBeVisible();
  await finishCountdown(page);
  await expect(page.getByText("Prueba 1 de 2", { exact: true })).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("local Connect Pairs Time Trial uses the same view and reviews the two board sizes", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (backendPath.test(new URL(request.url()).pathname)) backendRequests.push(request.url());
  });

  await page.goto("/demo/flash-pop");
  await expect(page.getByRole("link", { name: "Ensayar Conectar parejas" })).toHaveAttribute(
    "href",
    connectPairsPath,
  );
  await page.goto(connectPairsPath);
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prepárate", { exact: true })).toBeVisible();
  await finishCountdown(page);

  await expect(page.getByRole("heading", { name: "Conectar parejas" })).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.clock.runFor(1_500);
  await solveConnectPairs(page, 0);
  await expect(page.getByText("Prueba 2 de 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("grid", { name: /6×6/ })).toBeVisible();
  await solveConnectPairs(page, 1);
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible();
  await expect(page.getByText("2/2", { exact: true })).toBeVisible();
  await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await expect(page.getByText("2 de 2 resueltas")).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("returns 404 for an unknown local Time Trial id", async ({ request }) => {
  const response = await request.get("/demo/flash-pop/desafios/tabarnia-time-trial-unknown");
  expect(response.status()).toBe(404);
});
