import { expect, type Locator, type Page } from "@playwright/test";
import { placeQueensCrown } from "./queens";

export async function openLevel(page: Page, title: string) {
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Empezar nivel" }).click();
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 15_000 });
}

export async function waitForBriefing(page: Page, title: string) {
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
}

export async function reachOrden(page: Page) {
  await openLevel(page, "Encuentra el intruso");
  await page.getByRole("button", { name: "29", exact: true }).click();
  await waitForBriefing(page, "Completa la secuencia");

  await openLevel(page, "Completa la secuencia");
  const sequence = page.getByRole("region", { name: "Secuencia numérica" });
  await expect(sequence).toBeVisible();
  await expect(sequence.locator('[aria-label="Secuencia: 2, 6, 12, 20, ?"]')).toBeVisible();
  await page.getByRole("button", { name: "30", exact: true }).click();
  await waitForBriefing(page, "Completa la matriz");

  await openLevel(page, "Completa la matriz");
  await page.getByRole("button", { name: "Opción 1: Triángulo y flecha arriba" }).click();
  await waitForBriefing(page, "Construye el orden");

  await openLevel(page, "Construye el orden");
}

export async function reachCoronas(page: Page) {
  await reachOrden(page);
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
  await waitForBriefing(page, "Coloca las coronas");
  await expect(page.getByLabel("Condiciones del nivel")).toContainText("30 s");

  await openLevel(page, "Coloca las coronas");
  return page.getByRole("grid", { name: "Tablero Queens de 5 por 5" });
}

export async function reachCima(page: Page) {
  const queensBoard = await reachCoronas(page);
  for (const [row, column] of [
    [2, 1],
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
  return page.getByRole("grid", { name: /Tablero de Conectar parejas de 6×6/ });
}

export async function drawConexionesPaths(board: Locator, paths: readonly (readonly number[])[]) {
  for (const path of paths) {
    for (const cell of path) {
      const row = Math.floor(cell / 6) + 1;
      const column = (cell % 6) + 1;
      await board
        .getByRole("button", {
          name: new RegExp(`^Fila ${row}, columna ${column}(?:$|:)`),
        })
        .click();
    }
  }
}

export const completeSpiralPaths = [
  [0, 1, 7],
  [6, 12, 13, 14, 15],
  [9, 10, 16],
  [8, 2, 3, 4, 5, 11, 17, 23, 29, 35, 34, 33, 32, 31, 30, 24, 18],
  [22, 21, 20, 19, 25],
  [26, 27, 28],
] as const;

export const sevenPointPaths = [
  completeSpiralPaths[1],
  completeSpiralPaths[2],
  completeSpiralPaths[3],
] as const;
