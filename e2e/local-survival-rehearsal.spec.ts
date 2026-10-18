import { expect, test } from "@playwright/test";

const rehearsalPath = "/demo/flash-pop/desafios/tabarnia-challenge-03";
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

async function answerMatchingIncorrectly(page: import("@playwright/test").Page) {
  const leftItems = page.getByRole("region", { name: "Conceptos" }).getByRole("button");
  const rightItems = page.getByRole("region", { name: "Parejas" }).getByRole("button");
  const count = await leftItems.count();
  for (let index = 0; index < count; index++) {
    await leftItems.nth(index).click();
    await rightItems.nth((index + 2) % count).click();
  }
  await page.getByRole("button", { name: "Comprobar parejas" }).click();
}

test("plays, reviews, and repeats the 20-question local Survival rehearsal without backend calls", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (backendPath.test(url.pathname)) backendRequests.push(request.url());
  });

  await page.goto(rehearsalPath);
  await expect(page).toHaveURL(new RegExp(`${rehearsalPath}$`));
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prepárate")).toBeVisible();
  await finishCountdown(page);

  await expect(
    page.getByRole("heading", { name: "El Teide es el pico más alto de España." }),
  ).toBeVisible();
  await expect(page.getByLabel("3 de 3 vidas restantes")).toBeVisible();
  await page.getByRole("button", { name: "Falso" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Relaciona cada alimento con su lugar tradicional de origen.",
    }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("2 de 3 vidas restantes")).toBeVisible();
  await answerMatchingIncorrectly(page);
  await expect(
    page.getByRole("heading", { name: "Empareja cada ciudad con su monumento." }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("1 de 3 vidas restantes")).toBeVisible();
  await answerMatchingIncorrectly(page);
  await expect(page.getByRole("heading", { name: "Sin vidas" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("3 / 20", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await expect(page.getByText("3 de 20 retos alcanzados")).toBeVisible();
  await page.getByRole("button", { name: "Volver al resultado" }).click();
  await page.getByRole("button", { name: "Repetir ensayo" }).click();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("returns 404 for Survival ids outside the local rehearsal allowlist", async ({ request }) => {
  const response = await request.get("/demo/flash-pop/desafios/tabarnia-challenge-04");
  expect(response.status()).toBe(404);
});
