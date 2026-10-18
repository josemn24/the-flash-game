import { expect, test, type Page } from "@playwright/test";
import { alphabetAnimalsQuestions } from "../data/mock/catalog/questions/alphabetAnimals";

const rehearsalPath = "/demo/flash-pop/desafios/tabarnia-challenge-02";
const backendPath = /\/auth\/v1(?:\/|$)|\/storage\/v1(?:\/|$)|\/api\/competitive(?:\/|$)/i;
const challengeQuestions = ["a", "b", "c", "d", "e", "f", "i", "j", "l", "m", "o", "p", "r", "s", "t", "z"].map(
  (letter) => alphabetAnimalsQuestions.find((question) => question.slug === `alphabet-animals-${letter}`)!,
);

async function finishCountdown(page: Page) {
  await expect(page.locator('main [role="status"] strong').last()).toHaveText("3");
  for (const count of ["2", "1"]) {
    await expect(page.locator('main [role="status"] strong').last()).toHaveText(count, {
      timeout: 2_000,
    });
  }
  await expect(page.getByText("Prepárate", { exact: true })).toBeHidden();
}

async function answerLetter(page: Page, index: number, nextIndex: number | null) {
  const question = challengeQuestions[index]!;
  const answer = question.privatePayload.solution.payload.correctAnswer;
  await expect(page.getByRole("heading", { name: question.publicPayload.prompt })).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Tu respuesta" });
  await editor.fill(answer);
  await page.getByRole("button", { name: "Responder", exact: true }).click();
  if (nextIndex !== null) {
    await expect(
      page.getByRole("heading", {
        name: challengeQuestions[nextIndex]!.publicPayload.prompt,
      }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("textbox", { name: "Tu respuesta" })).toBeEnabled();
  }
}

test("the local 16-letter Alphabet rehearsal passes, revisits, reviews, and restarts without backend calls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (backendPath.test(new URL(request.url()).pathname)) backendRequests.push(request.url());
  });

  await page.goto("/demo/flash-pop");
  await expect(page.getByRole("link", { name: "Ensayar Alfabeto" })).toHaveAttribute(
    "href",
    rehearsalPath,
  );
  await page.goto(rehearsalPath);
  await expect(page.getByRole("heading", { name: "Reino de animales" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prepárate", { exact: true })).toBeVisible();
  await finishCountdown(page);

  await expect(
    page.getByRole("heading", { name: challengeQuestions[0]!.publicPayload.prompt }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "Usar teclado", exact: true }).click();
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: challengeQuestions[1]!.publicPayload.prompt }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Estado de las letras" }).getByRole("listitem", {
      name: "A: Pasada",
    }),
  ).toBeVisible();

  for (let index = 1; index < challengeQuestions.length; index++) {
    await answerLetter(page, index, index === challengeQuestions.length - 1 ? 0 : index + 1);
  }
  await expect(
    page.getByRole("list", { name: "Estado de las letras" }).getByRole("listitem", {
      name: "A: Activa",
    }),
  ).toBeVisible();
  await answerLetter(page, 0, null);
  await expect(page.locator("main")).toHaveAttribute("data-gameplay-layout", "results");
  await expect(page.locator("#challenge-result-title")).toHaveText("Alfabeto dominado", {
    timeout: 10_000,
  });
  await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await expect(page.locator("details")).toHaveCount(16);
  await page.getByRole("button", { name: "Jugar de nuevo" }).click();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await finishCountdown(page);
  await expect(
    page.getByRole("list", { name: "Estado de las letras" }).getByRole("listitem", {
      name: "A: Activa",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Estado de las letras" }).getByRole("listitem", {
      name: "B: Sin visitar",
    }),
  ).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("returns 404 for Alphabet ids outside the local rehearsal allowlist", async ({ request }) => {
  const response = await request.get("/demo/flash-pop/desafios/tabarnia-alphabet-unknown");
  expect(response.status()).toBe(404);
});
