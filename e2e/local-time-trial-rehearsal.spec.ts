import { expect, test, type Page } from "@playwright/test";
import { TABARNIA_CONNECT_PAIRS_TIME_TRIAL } from "../scripts/fixtures/scenarios/tabarnia-time-trial-connect-pairs.mjs";
import { TABARNIA_QUEENS_TIME_TRIAL } from "../scripts/fixtures/scenarios/tabarnia-time-trial-queens.mjs";

const queensPath = "/demo/flash-pop/desafios/tabarnia-time-trial-queens-01";
const connectPairsPath = "/demo/flash-pop/desafios/tabarnia-time-trial-connect-pairs-01";
const backendPath = /\/auth\/v1(?:\/|$)|\/storage\/v1(?:\/|$)|\/api\/competitive(?:\/|$)/i;

async function finishCountdown(page: Page) {
  // Keep performance.now() aligned with the native animation timeline. Advancing
  // Playwright's clock delays Motion's exit animations and blocks the next screen.
  for (const count of ["3", "2", "1"]) {
    await expect(page.locator('main [role="status"] strong').last()).toHaveText(count);
  }
}

function queensCell(page: Page, index: number, size: number) {
  return page.getByRole("gridcell", {
    name: new RegExp(`Fila ${Math.floor(index / size) + 1}, columna ${(index % size) + 1},`),
  });
}

async function solveQueens(page: Page, questionIndex: number) {
  const question = TABARNIA_QUEENS_TIME_TRIAL.questions[questionIndex]!;
  const size = question.publicPayload.grid.rows;
  const prefilled = question.publicPayload.prefilledQueens;
  for (const index of question.solutionPayload.solution) {
    if (!prefilled.includes(index)) await queensCell(page, index, size).click();
  }
}

function connectPairsCell(page: Page, questionIndex: number, index: number) {
  const size = TABARNIA_CONNECT_PAIRS_TIME_TRIAL.questions[questionIndex]!.publicPayload.grid.rows;
  return page.getByRole("button", {
    name: new RegExp(
      `^Fila ${Math.floor(index / size) + 1}, columna ${(index % size) + 1}(?:[:,]|$)`,
    ),
  });
}

async function solveConnectPairs(page: Page, questionIndex: number) {
  const paths = TABARNIA_CONNECT_PAIRS_TIME_TRIAL.questions[questionIndex]!.solutionPayload.paths;
  for (const path of Object.values(paths))
    for (const cell of path) await connectPairsCell(page, questionIndex, cell).click();
}

test("local Queens Time Trial shares the competitive view, can be reviewed and replayed without backend calls", async ({
  page,
}) => {
  test.setTimeout(90_000);
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
  for (const run of [1, 2]) {
    await test.step(`complete and review Queens run ${run}`, async () => {
      await page.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(page.getByText("Prepárate", { exact: true })).toBeVisible();
      await finishCountdown(page);

      await expect(page.getByRole("heading", { name: "Queens" })).toBeVisible();
      await expect(page.getByRole("timer")).toBeVisible();
      await expect(page.getByText("Prueba 1 de 6", { exact: true })).toBeVisible();
      for (
        let questionIndex = 0;
        questionIndex < TABARNIA_QUEENS_TIME_TRIAL.questions.length;
        questionIndex += 1
      ) {
        await expect(
          page.getByText(`Prueba ${questionIndex + 1} de 6`, { exact: true }),
        ).toBeVisible();
        await solveQueens(page, questionIndex);
      }
      await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText("6/6", { exact: true })).toBeVisible();
      await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
      await page.getByRole("button", { name: "Ver respuestas" }).click();
      await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText("6 de 6 resueltas")).toBeVisible();
      await page.getByRole("button", { name: "Volver al resultado" }).click();
      if (run === 1) await page.getByRole("button", { name: "Repetir ensayo" }).click();
    });
  }
  expect(backendRequests).toEqual([]);
});

test("local Connect Pairs Time Trial reviews and replays all six boards without backend calls", async ({
  page,
}) => {
  test.setTimeout(180_000);
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
  for (const run of [1, 2]) {
    await test.step(`complete and review Connect Pairs run ${run}`, async () => {
      await page.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(page.getByText("Prepárate", { exact: true })).toBeVisible();
      await finishCountdown(page);

      await expect(page.getByRole("heading", { name: "Conectar parejas" })).toBeVisible();
      await expect(page.getByRole("timer")).toBeVisible();
      for (
        let questionIndex = 0;
        questionIndex < TABARNIA_CONNECT_PAIRS_TIME_TRIAL.questions.length;
        questionIndex += 1
      ) {
        const question = TABARNIA_CONNECT_PAIRS_TIME_TRIAL.questions[questionIndex]!;
        const size = question.publicPayload.grid.rows;
        await expect(
          page.getByText(`Prueba ${questionIndex + 1} de 6`, { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("grid", { name: new RegExp(`${size}×${size}`) })).toBeVisible();
        await solveConnectPairs(page, questionIndex);
      }
      await expect(
        page.getByRole("heading", { name: "Todas las pruebas resueltas" }),
      ).toBeVisible();
      await expect(page.getByText("6/6", { exact: true })).toBeVisible();
      await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
      await page.getByRole("button", { name: "Ver respuestas" }).click();
      await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
      await expect(page.getByText("6 de 6 resueltas")).toBeVisible();
      await page.getByRole("button", { name: "Volver al resultado" }).click();
      if (run === 1) await page.getByRole("button", { name: "Repetir ensayo" }).click();
    });
  }
  expect(backendRequests).toEqual([]);
});

test("returns 404 for an unknown local Time Trial id", async ({ request }) => {
  const response = await request.get("/demo/flash-pop/desafios/tabarnia-time-trial-unknown");
  expect(response.status()).toBe(404);
});
