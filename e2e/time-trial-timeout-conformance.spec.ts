import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { placeQueensCrown } from "./support/queens";
import { registerTimeTrialConformance } from "./support/time-trial-conformance";

registerTimeTrialConformance({
  scenario: "time-trial-timeout-conformance",
  format: "queens",
  timeout: true,
  queensTimeoutPartialCredit: true,
});

test("timeout retries its close while a committed Queens checkpoint retry is held", async ({
  page,
}) => {
  test.setTimeout(60000);
  const fixture = JSON.parse(
    await readFile("output/fixtures/time-trial-timeout-conformance.json", "utf8"),
  );
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users.bob.email);
  await page.getByLabel("Contraseña").fill(fixture.users.bob.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.goto(`/desafios/${fixture.data.publicationId}?roomId=${fixture.data.room.slug}`);
  let releaseCheckpoint!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseCheckpoint = resolve;
  });
  const checkpoints: unknown[] = [];
  const closes: unknown[] = [];
  await page.route("**/queens/draft", async (route) => {
    checkpoints.push(route.request().postDataJSON());
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (checkpoints.length === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "command_failed" } }),
      });
      return;
    }
    await held;
    await route.fulfill({ response });
  });
  await page.route("**/attempts/*/complete", async (route) => {
    closes.push(route.request().postDataJSON());
    if (closes.length === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "command_failed" } }),
      });
      return;
    }
    await route.fulfill({ response: await route.fetch() });
  });
  try {
    await expect(
      page.getByText(/las coronas correctas que colocaste y quedaron guardadas/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Empezar desafío" }).click();
    await expect(page.getByText("Prueba 1 de 2", { exact: true })).toBeVisible({ timeout: 15000 });
    const crown = page.getByRole("gridcell", { name: /^Fila 3, columna 1,/ });
    await placeQueensCrown(crown);
    await expect.poll(() => checkpoints.length, { timeout: 8000 }).toBe(2);
    await expect(page.getByRole("heading", { name: "Resultado provisional" })).toBeVisible({
      timeout: 15000,
    });
    await expect(crown).toHaveAccessibleName(/corona/);
    await expect(page.getByRole("heading", { name: "Tu recorrido contrarreloj" })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText("Puntos parciales", { exact: true })).toBeVisible();
    expect(closes).toHaveLength(2);
    expect(closes[1]).toEqual(closes[0]);
    expect(checkpoints[1]).toEqual(checkpoints[0]);
    releaseCheckpoint();
    await page.reload();
    await expect(page.getByText("Puntos parciales", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    const review = page.locator("details").first();
    await review.locator("summary").click();
    const savedBoard = review.getByLabel("Tablero final del jugador");
    await expect(savedBoard).toBeVisible();
    await expect(review.getByText(/10 puntos/)).toBeVisible();
    await expect(
      savedBoard.getByRole("gridcell", { name: /^Fila 3, columna 1,.*corona/ }),
    ).toBeVisible();
  } finally {
    releaseCheckpoint();
  }
});
