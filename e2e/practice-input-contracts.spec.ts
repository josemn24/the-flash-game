import { placeQueensCrown } from "./support/queens";
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { QUESTION_FORMAT_CATALOG } from "../features/question-formats/catalog";

const formats = Object.values(QUESTION_FORMAT_CATALOG);
for (const width of [390, 1280]) {
  test.describe(`Práctica a ${width}px`, () => {
    test.use({
      viewport: { width, height: 900 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    for (const format of formats) {
      test(`${format.id}: abre controles y cierra sin transporte competitivo`, async ({ page }) => {
        const competitiveRequests: string[] = [];
        page.on("request", (request) => {
          if (new URL(request.url()).pathname.startsWith("/api/competitive/"))
            competitiveRequests.push(request.url());
        });
        await page.goto(`/formatos/${format.slug}`);
        await page.getByRole("button", { name: "Probar este formato" }).first().click();
        const dialog = page.getByRole("dialog");
        await expect(
          dialog.getByRole("heading", { name: format.examples[0].question.question, exact: true }),
        ).toBeVisible();
        await dialog.getByRole("button", { name: "Empezar ejemplo" }).click();
        // Some views also keep an inner marker; the outer match is the canonical input.
        const input = dialog.locator(`[data-format="${format.id}"]`).first();
        await expect(input).toBeVisible();
        await expect(
          input.locator("button:enabled, input:enabled, select:enabled, textarea:enabled").first(),
        ).toBeVisible({ timeout: 15_000 });
        await expect(dialog.getByRole("timer")).toBeVisible();
        const surface = dialog.locator("div").first();
        expect(
          await surface.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true);
        await mkdir("output/playwright/frontend-phase3", { recursive: true });
        await dialog.screenshot({
          path: `output/playwright/frontend-phase3/${format.id}-${width}.png`,
          animations: "disabled",
        });
        await dialog.getByRole("button", { name: "Cerrar ejemplo" }).click();
        await expect(dialog).toBeHidden();
        expect(competitiveRequests).toEqual([]);
      });
    }
  });
}

for (const format of [
  "flash-memory",
  "simon-sequence",
  "mini-wordle",
  "progressive-image",
] as const) {
  test(`${format}: difiere el temporizador hasta finalizar la preparación`, async ({ page }) => {
    const guide = QUESTION_FORMAT_CATALOG[format];
    let release: (() => void) | undefined;
    if (format === "mini-wordle" || format === "progressive-image") {
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        format === "mini-wordle" ? "**/dictionaries/*.json" : "**/_next/image?**",
        async (route) => {
          await ready;
          await route.continue();
        },
      );
    }
    await page.goto(`/formatos/${guide.slug}`);
    await page.getByRole("button", { name: "Probar este formato" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Empezar ejemplo" }).click();
    await expect(dialog.locator(`[data-format="${format}"]`)).toBeVisible();
    await expect(dialog.getByRole("timer")).toHaveCount(0);
    release?.();
    await expect(dialog.getByRole("timer")).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("timer")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Cerrar ejemplo" }).click();
  });
}

test("la respuesta corta conserva foco, envío local y reinicio del ejemplo", async ({ page }) => {
  await page.goto("/formatos/respuesta-corta");
  await page.getByRole("button", { name: "Probar este formato" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Empezar ejemplo" }).click();
  const input = dialog.getByLabel("Escribe tu respuesta");
  await expect(input).toBeFocused();
  await input.fill(" 1945 ");
  await input.press("Enter");
  await expect(dialog.getByText("Respuesta correcta", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await dialog.getByRole("button", { name: "Cerrar ejemplo" }).click();
});

test("código lógico conserva error local, retorno de acierto y foco", async ({ page }) => {
  const question = QUESTION_FORMAT_CATALOG["logic-code"].examples[0].question;
  await page.goto("/formatos/codigo-logico");
  await page.getByRole("button", { name: "Probar este formato" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Empezar ejemplo" }).click();
  const first = dialog.getByLabel(`Cifra 1 de ${question.codeLength}`);
  await first.fill(question.correctAnswer === "000" ? "111" : "000");
  await dialog.getByRole("button", { name: "Enviar código" }).click();
  await expect(dialog.getByText("Código incorrecto. Prueba otra combinación.")).toBeVisible();
  await expect(dialog.getByText("1 intento incorrecto")).toBeVisible();
  await expect(first).toHaveValue("");
  await expect(first).toBeFocused();
  await first.fill(question.correctAnswer);
  await dialog.getByRole("button", { name: "Enviar código" }).click();
  await expect(dialog.getByRole("heading", { name: "Resultado del ejemplo" })).toBeVisible();
  await expect(dialog.getByText("Respuesta correcta", { exact: true }).first()).toBeVisible();
});

test("pistas progresivas conserva revelación, progreso y respuesta local", async ({ page }) => {
  const question = QUESTION_FORMAT_CATALOG["progressive-clues"].examples[0].question;
  await page.goto("/formatos/adivinanzas-por-pistas");
  await page.getByRole("button", { name: "Probar este formato" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Empezar ejemplo" }).click();
  await expect(
    dialog.getByRole("list", { name: "Pistas reveladas" }).getByRole("listitem"),
  ).toHaveCount(1);
  await dialog.getByRole("button", { name: /Revelar otra pista/ }).click();
  await expect(
    dialog.getByRole("list", { name: "Pistas reveladas" }).getByRole("listitem"),
  ).toHaveCount(2);
  await dialog.getByLabel("Escribe tu respuesta").fill(question.correctAnswer);
  await dialog.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(dialog.getByRole("heading", { name: "Resultado del ejemplo" })).toBeVisible();
  await expect(dialog.getByText("Respuesta correcta", { exact: true }).first()).toBeVisible();
});

test("clasificación conserva el borrador estructurado hasta confirmar", async ({ page }) => {
  const question = QUESTION_FORMAT_CATALOG.classification.examples[0].question;
  await page.goto("/formatos/clasificar");
  await page.getByRole("button", { name: "Probar este formato" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Empezar ejemplo" }).click();
  for (const item of question.items) {
    await dialog
      .getByRole("group", { name: `Clasificar ${item.label}` })
      .getByRole("button", { name: new RegExp(`como ${item.correctCategory}$`, "i") })
      .click();
  }
  await expect(
    dialog.getByText(`${question.items.length} de ${question.items.length} clasificados`, {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar clasificación" }).click();
  await expect(dialog.getByRole("heading", { name: "Resultado del ejemplo" })).toBeVisible();
  await expect(dialog.getByText("Respuesta correcta", { exact: true }).first()).toBeVisible();
});

test("Queens practice supports keyboard cycling and cancellable validation", async ({ page }) => {
  await page.goto("/formatos/queens");
  await page.getByRole("button", { name: "Probar este formato" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Empezar ejemplo" }).click();
  const cell = (index: number) =>
    dialog.getByRole("gridcell", {
      name: new RegExp(`Fila ${Math.floor(index / 5) + 1}, columna ${(index % 5) + 1},`),
    });
  for (const index of [2, 9, 10, 18]) await placeQueensCrown(cell(index));
  const target = cell(20);
  await target.press("Space");
  await expect(target).toHaveAccessibleName(/marcada con X/);
  await target.press("Enter");
  await target.press("Space");
  await expect(target).toHaveAccessibleName(/: vacía/);
  await page.waitForTimeout(900);
  await expect(dialog.getByText(/1 intento incorrecto/)).toHaveCount(0);
  await placeQueensCrown(cell(21));
  await expect(dialog.getByRole("heading", { name: "Resultado del ejemplo" })).toBeVisible();
});
