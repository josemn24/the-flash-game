import { placeQueensCrown } from "./support/queens";
import { expect, test } from "@playwright/test";

const rehearsalPath = "/demo/flash-pop/desafios/tabarnia-challenge-05";

async function openLevel(page: import("@playwright/test").Page, title: string) {
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Empezar nivel" }).click();
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 });
}

async function waitForBriefing(page: import("@playwright/test").Page, title: string) {
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
}

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

  await openLevel(page, "Encuentra el intruso");
  await page.getByRole("button", { name: "27", exact: true }).click();
  await waitForBriefing(page, "Completa la secuencia");

  await openLevel(page, "Completa la secuencia");
  await page.getByRole("button", { name: "30", exact: true }).click();
  await waitForBriefing(page, "Construye el orden");

  await openLevel(page, "Construye el orden");
  const currentOrder = ["Sol", "Río", "Nube", "Mar", "Luna"];
  const correctOrder = ["Río", "Mar", "Sol", "Luna", "Nube"];
  for (const [targetIndex, item] of correctOrder.entries()) {
    let index = currentOrder.indexOf(item);
    while (index > targetIndex) {
      await page.getByRole("button", { name: `Mover ${item} arriba` }).click();
      [currentOrder[index - 1], currentOrder[index]] = [
        currentOrder[index]!,
        currentOrder[index - 1]!,
      ];
      index -= 1;
    }
  }
  await page.getByRole("button", { name: "Confirmar orden" }).click();
  await waitForBriefing(page, "Completa la matriz");

  await openLevel(page, "Completa la matriz");
  await page.getByRole("button", { name: "Opción 1: Triángulo y flecha arriba" }).click();
  await waitForBriefing(page, "Cubre la cuadrícula");

  await openLevel(page, "Cubre la cuadrícula");
  const board = page.getByRole("grid", { name: /Tablero de Conectar parejas/ });
  const paths = [
    [0, 1, 2, 3, 4, 9],
    [8, 7, 6, 5, 10],
    [11, 12, 13, 14, 19, 18],
    [17, 16, 15, 20, 21, 22, 23, 24],
  ];
  for (const path of paths) {
    for (const cell of path) {
      const row = Math.floor(cell / 5) + 1;
      const column = (cell % 5) + 1;
      await board
        .getByRole("button", { name: new RegExp(`^Fila ${row}, columna ${column}(?:$|:)`) })
        .click();
    }
  }
  await waitForBriefing(page, "Descifra la cerradura");

  await openLevel(page, "Descifra la cerradura");
  await page.getByLabel("Cifra 1 de 3").fill("507");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await waitForBriefing(page, "Conquista la cima");

  await openLevel(page, "Conquista la cima");
  const queensBoard = page.getByRole("grid", { name: "Tablero Queens de 5 por 5" });
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
  const response = await request.get("/demo/flash-pop/desafios/tabarnia-challenge-06");
  expect(response.status()).toBe(404);
});
