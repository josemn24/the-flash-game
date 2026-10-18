import { expect, test } from "@playwright/test";

const rehearsalPath = "/demo/flash-pop/desafios/tabarnia-flash-01";
const backendPath = /\/auth\/v1(?:\/|$)|\/storage\/v1(?:\/|$)|\/api\/competitive(?:\/|$)/i;

async function finishCountdown(page: import("@playwright/test").Page) {
  await expect(page.locator('main [role="status"] strong').last()).toHaveText("3");
  for (const count of ["2", "1"]) {
    await page.clock.runFor(1_000);
    await expect(page.locator('main [role="status"] strong').last()).toHaveText(count);
  }
  await page.clock.runFor(1_000);
  await page.waitForTimeout(25);
}

async function waitForQuestion(page: import("@playwright/test").Page, heading: string | RegExp) {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 10_000 });
}

async function answerWithFirstQuestionButton(page: import("@playwright/test").Page) {
  await page.locator("main section[aria-labelledby]").getByRole("button").first().click();
}

test("plays, reviews, and repeats the 16-question local Flash rehearsal without backend calls", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (backendPath.test(url.pathname)) backendRequests.push(request.url());
  });

  await page.goto(rehearsalPath);
  await expect(page).toHaveURL(new RegExp(`${rehearsalPath}$`));
  await expect(page.getByRole("heading", { name: "Steel Ball Run" })).toBeVisible();
  const start = page.getByRole("button", { name: "Empezar desafío" });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Prepárate")).toBeVisible();
  await finishCountdown(page);

  await expect(
    page.getByRole("heading", {
      name: "¿Qué cultura celebra en 2026 el Año del Caballo de Fuego, que se repite cada 60 años?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "La cultura azteca" }).click();
  await waitForQuestion(page, "¿Cuál de estos animales no pertenece a la familia de los équidos?");
  await answerWithFirstQuestionButton(page);
  await waitForQuestion(page, "Relaciona cada país con su moneda.");

  const leftItems = ["Estados Unidos", "Japón", "México", "España"];
  const rightItems = ["Yen", "Dólar", "Peso", "Euro"];
  for (const [index, country] of leftItems.entries()) {
    await page.getByRole("button", { name: country, exact: true }).click();
    await page.getByRole("button", { name: rightItems[index]!, exact: true }).click();
  }
  await page.getByRole("button", { name: "Comprobar parejas" }).click();
  await waitForQuestion(page, "Ordena estas ciudades de oeste a este.");

  await page.getByRole("button", { name: "Confirmar orden" }).click();
  await waitForQuestion(page, "¿Qué paisaje aparece en la imagen?");
  const imageAnswer = page.locator("#progressive-image-answer");
  await expect(imageAnswer).toBeEnabled({ timeout: 15_000 });
  await imageAnswer.fill("Cañón");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await waitForQuestion(
    page,
    "Marca aproximadamente dónde se encuentra el Gran Cañón en este mapa.",
  );

  await page
    .getByRole("button", { name: /Pulsa sobre la imagen para colocar el marcador/ })
    .click();
  await page.getByRole("button", { name: "Confirmar ubicación" }).click();
  await waitForQuestion(page, "¿Cuál es su velocidad media?");
  await page.getByRole("button", { name: "Confirmar estimación" }).click();
  await waitForQuestion(
    page,
    "Clasifica cada objeto según encaje o no en una carrera ambientada en 1890.",
  );

  const classificationRows = page.getByRole("group", { name: /^Clasificar / });
  for (let index = 0; index < (await classificationRows.count()); index++)
    await classificationRows.nth(index).getByRole("button").first().click();
  await page.getByRole("button", { name: "Confirmar clasificación" }).click();
  await waitForQuestion(page, "Forma una palabra relacionada con el desafío.");
  const availableLetters = page.locator('button[aria-label^="Añadir letra"]:not(:disabled)');
  while (await availableLetters.count()) await availableLetters.first().click();
  await page.getByRole("button", { name: "Enviar palabra" }).click();
  await waitForQuestion(page, "¿Qué transportaba principalmente el Pony Express?");
  await answerWithFirstQuestionButton(page);
  await waitForQuestion(page, "Los caballos pueden dormir de pie.");
  await page.getByRole("button", { name: "Verdadero" }).click();
  await waitForQuestion(page, "¿Qué dos elementos forman principalmente el acero?");
  await answerWithFirstQuestionButton(page);
  await waitForQuestion(page, "Ordena estos movimientos del caballo de menor a mayor velocidad.");
  await page.getByRole("button", { name: "Confirmar orden" }).click();
  await waitForQuestion(page, /¿qué pasa con el aire que va más rápido sobre su lomo\?/i);
  await answerWithFirstQuestionButton(page);
  await waitForQuestion(page, /quedas primero\./i);
  await page.getByRole("button", { name: "Falso" }).click();
  await waitForQuestion(page, "¿Qué mangaka es el autor de Steel Ball Run?");
  await answerWithFirstQuestionButton(page);

  await expect(page.getByRole("heading", { name: "Desafío duro." })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await expect(page.getByText("16 respuestas")).toBeVisible();
  await page.getByRole("button", { name: "Volver al resultado" }).click();
  await page.getByRole("button", { name: "Repetir ensayo" }).click();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("supports mobile reduced motion and keyboard start without a session", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(rehearsalPath);
  const start = page.getByRole("button", { name: "Empezar desafío" });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  await finishCountdown(page);
  await expect(page.getByRole("timer")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("returns 404 for Flash ids outside the local rehearsal allowlist", async ({ request }) => {
  const response = await request.get("/demo/flash-pop/desafios/tabarnia-flash-02");
  expect(response.status()).toBe(404);
});
