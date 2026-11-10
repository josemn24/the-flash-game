import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { registerTimeTrialConformance } from "./support/time-trial-conformance";

const scenario = "time-trial-connect-pairs-partial";
registerTimeTrialConformance({
  scenario,
  format: "connect-pairs",
  timeout: "partial",
  connectPairsTimeoutPartialCredit: true,
});

test.describe("Connect Pairs checkpoint solved at expiry", () => {
  registerTimeTrialConformance({
    scenario,
    format: "connect-pairs",
    timeout: "checkpoint",
    connectPairsTimeoutPartialCredit: true,
  });
});

test("scores the committed route despite lost checkpoint and completion confirmations", async ({
  page,
}) => {
  test.setTimeout(60000);
  const fixture = JSON.parse(await readFile(`output/fixtures/${scenario}.json`, "utf8"));
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
  const loseConfirmation = {
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "command_failed" } }),
  };
  await page.route("**/connect-pairs/draft", async (route) => {
    const input = route.request().postDataJSON();
    const response = await route.fetch();
    if (input.paths?.a?.length !== 4) return route.fulfill({ response });
    expect(response.ok()).toBe(true);
    checkpoints.push(input);
    if (checkpoints.length === 1) return route.fulfill(loseConfirmation);
    await held;
    await route.fulfill({ response });
  });
  await page.route("**/attempts/*/complete", async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    closes.push(route.request().postDataJSON());
    if (closes.length === 1) return route.fulfill(loseConfirmation);
    await route.fulfill({ response });
  });

  try {
    await expect(
      page.getByText(/los caminos completos guardados pueden sumar puntos/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Empezar desafío" }).click();
    await expect(page.getByText("Prueba 1 de 2", { exact: true })).toBeVisible({ timeout: 15000 });
    for (const column of [1, 2, 3, 4])
      await page
        .getByRole("button", { name: new RegExp(`^Fila 1, columna ${column}(?:[:,]|$)`) })
        .click();
    await expect.poll(() => checkpoints.length).toBe(2);
    await expect(page.getByRole("heading", { name: "Tu recorrido contrarreloj" })).toBeVisible({
      timeout: 20000,
    });
    expect(checkpoints[1]).toEqual(checkpoints[0]);
    expect(closes).toHaveLength(2);
    expect(closes[1]).toEqual(closes[0]);
    releaseCheckpoint();
    await page.reload();
    await expect(page.getByLabel("2 de 100 puntos")).toBeVisible();
    await expect(page.getByText("Puntos parciales", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    const review = page.locator("details").first();
    await expect(review.locator("summary").getByText("Parcial", { exact: true })).toBeVisible();
    await review.locator("summary").click();
    await expect(review.getByText("4/25", { exact: true })).toBeVisible();
    await expect(review.getByText("1/5", { exact: true })).toBeVisible();
    await expect(review.getByText(/2 puntos/)).toBeVisible();
  } finally {
    releaseCheckpoint();
  }
});
