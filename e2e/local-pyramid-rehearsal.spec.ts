import { placeQueensCrown } from "./support/queens";
import { expect, test } from "@playwright/test";
import {
  completeSpiralPaths,
  drawConexionesPaths,
  openLevel,
  reachCima,
  reachCoronas,
  sevenPointPaths,
  waitForBriefing,
} from "./support/cumbre-logica";

const rehearsalPath = "/demo/flash-pop/desafios/tabarnia-challenge-05";

test("plays, reviews, and repeats the seven-level local Pyramid without backend calls", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /\/auth\/v1(?:\/|$)|\/storage\/v1(?:\/|$)|\/api\/competitive\/attempts(?:\/|$)/i.test(
        url.pathname,
      )
    )
      backendRequests.push(request.url());
  });

  await page.goto(rehearsalPath);
  await expect(page).toHaveURL(new RegExp(`${rehearsalPath}$`));
  await expect(page.getByRole("heading", { name: "Cumbre lógica" })).toBeVisible();
  const start = page.getByRole("button", { name: "Empezar desafío" });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");

  const levelMap = page.getByRole("list", { name: "Niveles de La Pirámide" });
  await expect(levelMap.locator("li > span")).toHaveText(["7", "6", "5", "4", "3", "2", "1"]);
  await expect(levelMap.locator("li > strong")).toHaveText([
    "Cima",
    "Cerradura",
    "Coronas",
    "Orden",
    "Cámara",
    "Patrón",
    "Entrada",
  ]);
  const queensBoard = await reachCoronas(page);
  const firstQueen = queensBoard.getByRole("gridcell", { name: /Fila 2, columna 1/ });
  await firstQueen.focus();
  await page.keyboard.press("Space");
  await expect(firstQueen).toHaveAccessibleName(/marcada con X/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status", { name: "Progreso de coronas" })).toContainText("2/5");
  for (const [row, column] of [
    [3, 4],
    [4, 2],
    [5, 5],
  ]) {
    await placeQueensCrown(
      queensBoard.getByRole("gridcell", { name: new RegExp(`Fila ${row}, columna ${column}`) }),
    );
  }

  await waitForBriefing(page, "Descifra la cerradura");
  await openLevel(page, "Descifra la cerradura");
  await page.getByLabel("Cifra 1 de 3").fill("507");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await waitForBriefing(page, "Conquista la cima");
  await expect(page.getByLabel("Condiciones del nivel")).toContainText("20 s");
  await openLevel(page, "Conquista la cima");
  const board = page.getByRole("grid", { name: /Tablero de Conectar parejas de 6×6/ });
  await drawConexionesPaths(board, completeSpiralPaths);

  await expect(page.getByRole("heading", { name: "Cima conquistada" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await expect(page.getByText("7 de 7 superados")).toBeVisible();
  await expect(page.getByText("No alcanzado")).toHaveCount(0);

  await page.getByRole("button", { name: "Volver al resultado" }).click();
  await page.getByRole("button", { name: "Repetir ensayo" }).click();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("shows timeout credit at Cima after completing the first six levels", async ({ page }) => {
  await page.clock.install();
  await page.goto(rehearsalPath);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  const board = await reachCima(page);
  await drawConexionesPaths(board, sevenPointPaths);
  await page.clock.runFor(21_000);
  await expect(page.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
  await expect(page.getByText("+7 puntos en Cima")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByText("6 de 7 superados")).toBeVisible();
  await expect(page.getByText("No alcanzado", { exact: true })).toHaveCount(0);
});

test("supports a mobile reduced-motion layout and keyboard start without authentication", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(rehearsalPath);
  await expect(page).toHaveURL(new RegExp(`${rehearsalPath}$`));
  const start = page.getByRole("button", { name: "Empezar desafío" });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Encuentra el intruso" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("returns 404 for unapproved local challenge ids", async ({ request }) => {
  const response = await request.get("/demo/flash-pop/desafios/tabarnia-challenge-99");
  expect(response.status()).toBe(404);
});

test("plays La Biblia locally and credits a confirmed matching partial", async ({ page }) => {
  await page.goto("/demo/flash-pop/desafios/tabarnia-challenge-06");
  await expect(page.getByRole("heading", { name: "La Biblia", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await openLevel(page, "Relaciona las figuras");
  for (const [left, right] of [
    ["Noé", "Arca"],
    ["Moisés", "Éxodo"],
    ["David", "Nazaret"],
    ["Jesús", "Goliat"],
  ]) {
    await page.getByRole("button", { name: left, exact: true }).click();
    await page.getByRole("button", { name: right, exact: true }).click();
  }
  await page.getByRole("button", { name: "Comprobar parejas" }).click();
  await expect(page.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
  await expect(page.getByText("+6 puntos en Entrada")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByText("0 de 7 superados")).toBeVisible();
  await expect(page.getByText("No alcanzado", { exact: true })).toHaveCount(6);
});
