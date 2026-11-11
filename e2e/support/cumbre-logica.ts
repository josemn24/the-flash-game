import { expect, type Locator, type Page } from "@playwright/test";

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

export async function reachConexiones(page: Page) {
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
  await waitForBriefing(page, "Cubre la cuadrícula");

  await openLevel(page, "Cubre la cuadrícula");
  return page.getByRole("grid", { name: /Tablero de Conectar parejas/ });
}

export async function drawConexionesPaths(board: Locator, paths: readonly (readonly number[])[]) {
  for (const path of paths) {
    for (const cell of path) {
      const row = Math.floor(cell / 5) + 1;
      const column = (cell % 5) + 1;
      await board
        .getByRole("button", {
          name: new RegExp(`^Fila ${row}, columna ${column}(?:$|:)`),
        })
        .click();
    }
  }
}

export const sevenPointPaths = [
  [0, 1, 2, 3, 4, 9],
  [11, 12, 13, 14, 19, 18],
] as const;
