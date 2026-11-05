import { placeQueensCrown } from "./support/queens";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dockerSql, sqlCount } from "../scripts/support/supabase-local.mjs";
import { repositoryRehearsalQuestions } from "../scripts/support/rehearsal-catalog.mjs";
import { exerciseHash } from "../lib/rehearsals/hash";

type Account = { email: string; password: string; playerId: string };
type Publication = { id: string; mode: string; challengeVersionId: string; challengeId: string };
type Fixture = {
  users: Record<string, Account>;
  data: { publications: Publication[]; publicationId: string; challengeVersionId: string };
};
const snapshots = new Map<string, string>();
async function competitiveSnapshot() {
  return (
    await dockerSql(`select jsonb_build_object(
    'attempts',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.attempts t),
    'answers',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from private.attempt_answers t),
    'ledger',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from private.flash_point_entries t));`)
  ).stdout;
}
test.beforeEach(async ({}, info) => {
  snapshots.set(info.testId, await competitiveSnapshot());
});
test.afterEach(async ({}, info) => {
  if (!info.title.startsWith("starting an official"))
    expect(await competitiveSnapshot()).toBe(snapshots.get(info.testId));
  snapshots.delete(info.testId);
});
const fixture = (name: string) =>
  JSON.parse(readFileSync(`output/fixtures/${name}.json`, "utf8")) as Fixture;
async function login(page: Page, account: Account) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}
function entry(index: number) {
  if (index === 6)
    return {
      id: fixture("tabarnia").data.publications.find((p) => p.mode === "flash")!.id,
      room: "tabarnia",
    };
  const publication = fixture("betavip").data.publications[index]!;
  return {
    id: publication.id,
    room: "beta-vip",
  };
}
async function expectGameReady(page: Page, index: number) {
  await expect(page.getByRole("button", { name: "Empezar prueba" })).toHaveCount(0);
  if (index === 2 || index === 5)
    await expect(page.getByRole("button", { name: "Empezar nivel" })).toBeVisible();
  else await expect(page.getByRole("timer")).toBeVisible({ timeout: 10_000 });
}
async function open(page: Page, index: number) {
  const { id, room } = entry(index);
  await page.goto(`/desafios/${id}?roomId=${room}`);
  await expect(page.getByRole("link", { name: "Probar primero" })).toBeVisible();
  await page.getByRole("link", { name: "Probar primero" }).click();
  await expectGameReady(page, index);
  return entry(index);
}
for (let index = 0; index < 7; index++) {
  test(`authorized rehearsal ${index + 1} starts independently and survives neither reload nor exit`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const account = fixture("betavip").users.ches!;
    await login(page, account);
    const writes: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/competitive/attempts"))
        writes.push(request.url());
    });
    const selected = await open(page, index);
    const firstRecipe = JSON.parse(
      (await page.locator("script[data-rehearsal-recipe]").textContent())!,
    );
    const firstSession = firstRecipe.sessionId;
    expect(firstRecipe.generatorVersion).toBe(1);
    const questions = await selectedQuestions(page);
    expect(new Set(questions.map(exerciseHash)).size).toBe(questions.length);
    expect(
      questions.every((q: { generationStatus?: string }) => q.generationStatus !== "retired"),
    ).toBe(true);
    await page.reload();
    await expectGameReady(page, index);
    expect(
      JSON.parse((await page.locator("script[data-rehearsal-recipe]").textContent())!).sessionId,
    ).not.toBe(firstSession);
    await page.goto(`/desafios/${selected.id}?roomId=${selected.room}`);
    await expect(page).toHaveURL(new RegExp(`/desafios/${selected.id}\\?roomId=${selected.room}$`));
    expect(writes).toEqual([]);
    expect(
      await sqlCount(
        `select count(*) from public.attempts where player_id='${account.playerId}' and scheduled_challenge_id='${selected.id}'`,
      ),
    ).toBe(0);
  });
}
test("practice uses the full Queens flow, review and return without writing official results", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, fixture("betavip").users.ches!);
  await open(page, 3);
  const questions = await selectedQuestions(page);
  expect(questions).toHaveLength(7);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/competitive/attempts"))
      writes.push(request.url());
  });
  for (const [index, q] of questions.entries()) {
    await expect(
      page.getByText(`Prueba ${index + 1} de ${questions.length}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    const size = q.publicPayload.grid.rows;
    for (const cell of q.solutionPayload.solution) {
      if (q.publicPayload.prefilledQueens.includes(cell)) continue;
      await placeQueensCrown(
        page.getByRole("gridcell", {
          name: new RegExp(`Fila ${Math.floor(cell / size) + 1}, columna ${(cell % size) + 1},`),
        }),
      );
    }
  }
  await reviewAndReturn(page, 3);
  expect(writes).toEqual([]);
});

async function selectedQuestions(page: Page) {
  const recipe = JSON.parse((await page.locator("script[data-rehearsal-recipe]").textContent())!);
  const bank = repositoryRehearsalQuestions();
  return recipe.questions.map((ref: { id: string; version: number }) =>
    bank.find(
      (q: { id: string; version: number }) => q.id === ref.id && q.version === ref.version,
    )!,
  );
}
async function reviewAndReturn(page: Page, index: number) {
  await expect(page.getByText("Puntos de prueba", { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText(
      "Esta partida ha sido de prueba. No consume tu intento competitivo ni cuenta para el ranking.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver al desafío" })).toHaveAttribute(
    "data-variant",
    "primary",
  );
  await expect(page.getByRole("button", { name: "Ver respuestas" })).toHaveAttribute(
    "data-variant",
    "secondary",
  );
  await expect(page.getByRole("button", { name: "Repetir prueba" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Repetir prueba" })).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al resultado" }).click();
  await page.getByRole("button", { name: "Volver al desafío" }).click();
  const { id, room } = entry(index);
  await expect(page).toHaveURL(new RegExp(`/desafios/${id}\\?roomId=${room}$`));
  await expect(page.getByRole("link", { name: "Probar primero" })).toBeVisible();
}

test("Connect Pairs completes and reviews all seven practice boards", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, fixture("betavip").users.ches!);
  await open(page, 0);
  const questions = await selectedQuestions(page);
  expect(questions).toHaveLength(7);
  for (const [index, q] of questions.entries()) {
    await expect(
      page.getByText(`Prueba ${index + 1} de ${questions.length}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    const size = q.publicPayload.grid.rows;
    for (const path of Object.values(q.solutionPayload.paths) as number[][])
      for (const cell of path)
        await page
          .getByRole("button", {
            name: new RegExp(
              `^Fila ${Math.floor(cell / size) + 1}, columna ${(cell % size) + 1}(?:[:,]|$)`,
            ),
          })
          .click();
  }
  await reviewAndReturn(page, 0);
});

test("Alphabet passes and revisits a letter, then reviews the whole practice", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, fixture("betavip").users.ches!);
  await open(page, 1);
  const questions = await selectedQuestions(page);
  await expect(
    page.getByRole("heading", { name: questions[0].publicPayload.question, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Usar teclado", exact: true }).click();
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  for (const q of [...questions.slice(1), questions[0]]) {
    await expect(
      page.getByRole("heading", { name: q.publicPayload.question, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("textbox", { name: "Tu respuesta" })).toBeEnabled();
    await page.getByRole("textbox", { name: "Tu respuesta" }).fill(q.solutionPayload.correctAnswer);
    await page.getByRole("button", { name: "Responder", exact: true }).click();
  }
  await reviewAndReturn(page, 1);
});

test("Pyramid failed ascent keeps later levels out of review and returns to the challenge", async ({
  page,
}) => {
  await login(page, fixture("betavip").users.ches!);
  await open(page, 5);
  await page.getByRole("button", { name: "Empezar nivel" }).click();
  const left = page.getByRole("region", { name: "Conceptos" }).getByRole("button");
  const right = page.getByRole("region", { name: "Parejas" }).getByRole("button");
  const q = (await selectedQuestions(page))[0];
  for (const [index, item] of q.publicPayload.leftItems.entries()) {
    await left.nth(index).click();
    const correct = q.solutionPayload.matches[item.id];
    // A permutation of the right column keeps the submitted matching complete.
    await right
      .nth(
        (q.publicPayload.rightItems.findIndex((r: { id: string }) => r.id === correct) + 1) %
          q.publicPayload.rightItems.length,
      )
      .click();
  }
  await page.getByRole("button", { name: "Comprobar parejas" }).click();
  await reviewAndReturn(page, 5);
});

test("Survival practice removes lives and reaches its own terminal result", async ({ page }) => {
  await login(page, fixture("betavip").users.ches!);
  await open(page, 4);
  const questions = await selectedQuestions(page);
  await page
    .getByRole("button", {
      name: questions[0].solutionPayload.correctAnswer ? "Falso" : "Verdadero",
      exact: true,
    })
    .click();
  const wrong = questions[1].publicPayload.options.find(
    (option: string) => option !== questions[1].solutionPayload.correctAnswer,
  );
  await page.getByRole("button", { name: wrong, exact: true }).click();
  await expect(page.getByLabel("1 de 3 vidas restantes")).toBeVisible();
  const lastLifeQuestion = questions[2];
  expect(lastLifeQuestion.type).toBe("progressive-image");
  const answerLabel = lastLifeQuestion.publicPayload.answerLabel ?? "Tu respuesta";
  await page.getByRole("textbox", { name: answerLabel }).fill("incorrecta");
  await page.getByRole("button", { name: "Enviar respuesta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sin vidas" })).toBeVisible({ timeout: 15_000 });
  await reviewAndReturn(page, 4);
});

test("asset failures can be retried before any trial clock begins", async ({ page }) => {
  await login(page, fixture("betavip").users.ches!);
  let fail = true;
  await page.route("**/rehearsals/v1/*.svg", (route) => (fail ? route.abort() : route.continue()));
  const { id, room } = entry(6);
  await page.goto(`/desafios/${id}/prueba?roomId=${room}`);
  await expect(page.getByRole("alert").filter({ hasText: "recursos" })).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expectGameReady(page, 6);
});

test("starting an official attempt removes practice access, including a direct URL", async ({
  page,
}) => {
  await login(page, fixture("betavip").users.ches!);
  const { id, room } = entry(0);
  await page.goto(`/desafios/${id}?roomId=${room}`);
  const started = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/competitive/attempts/start",
    { timeout: 20000 },
  );
  await page.getByRole("button", { name: "Empezar desafío", exact: true }).click();
  expect((await started).ok()).toBe(true);
  await expect
    .poll(() =>
      sqlCount(`select count(*) from public.attempts where scheduled_challenge_id='${id}'`),
    )
    .toBe(1);
  await page.goto(`/desafios/${id}/prueba?roomId=${room}`);
  await expect(page.getByRole("heading", { name: "Ruta fuera de pista" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar prueba" })).toHaveCount(0);
  await page.goto(`/desafios/${id}?roomId=${room}`);
  await expect(page.getByRole("link", { name: "Probar primero" })).toHaveCount(0);
});

test("Flash timeout advances the practice without recording any official answer", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page, fixture("betavip").users.ches!);
  const selected = await open(page, 6);
  const questions = await selectedQuestions(page);
  await expect(page.getByText(`Pregunta 01 de ${questions.length}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Pregunta 02 de ${questions.length}`, { exact: true })).toBeVisible({
    timeout: 25_000,
  });
  await page.goto(`/desafios/${selected.id}?roomId=${selected.room}`);
  await expect(page.getByRole("link", { name: "Probar primero" })).toBeVisible();
});

test("editorial coverage and generated preview are restricted to superadmins", async ({ page }) => {
  await login(page, fixture("betavip").users.xesmona!);
  const publication = fixture("betavip").data.publications[3]!;
  await page.goto(`/admin/challenges/${publication.challengeId}`);
  const panel = page.getByRole("region", { name: "Pruebas del desafío" });
  await expect(panel.getByText("Cobertura disponible")).toBeVisible();
  await expect(
    panel.getByText("La combinación requiere sustituir alguna dificultad por una próxima"),
  ).toBeVisible();
  await expect(panel.getByRole("combobox", { name: "Ensayo compatible" })).toHaveCount(0);
  await panel.getByRole("link", { name: "Generar vista previa" }).click();
  await expectGameReady(page, 3);
  await expect(page.getByText("Receta generada")).toBeVisible();
  await expect(page.getByRole("region", { name: "Ajustes de dificultad" })).toBeVisible();
  const recipe = () => page.locator("script[data-rehearsal-recipe]").textContent();
  await page.getByLabel("Semilla (opcional)").fill("browser-fixed-seed");
  await page.getByRole("button", { name: "Generar combinación" }).click();
  await expect.poll(async () => JSON.parse((await recipe())!).seed).toBe("browser-fixed-seed");
  const reproducible = (await recipe())!;
  await page.getByLabel("Semilla (opcional)").fill("");
  await page.getByRole("button", { name: "Generar combinación" }).click();
  await expect.poll(recipe).not.toBe(reproducible);
  await page.getByLabel("Receta para reproducir").fill(reproducible);
  await page.getByRole("button", { name: "Reproducir receta" }).click();
  await expect.poll(recipe).toBe(reproducible);
  for (const generatorVersion of [2, 3]) {
    const unsupported = { ...JSON.parse(reproducible), generatorVersion };
    await page.getByLabel("Receta para reproducir").fill(JSON.stringify(unsupported));
    await page.getByRole("button", { name: "Reproducir receta" }).click();
    await expect(page.getByRole("button", { name: "Reproducir receta" })).toBeEnabled();
    await expect(page.getByRole("alert").filter({ hasText: "no corresponde" })).toBeVisible();
    await expect.poll(recipe).toBe(reproducible);
  }
  const damaged = JSON.parse(reproducible);
  damaged.questions[0].contentHash = "0".repeat(64);
  await page.getByLabel("Receta para reproducir").fill(JSON.stringify(damaged));
  await page.getByRole("button", { name: "Reproducir receta" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Falta una versión" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "output/rehearsal-mobile.png", fullPage: true });
  await page.context().clearCookies();
  await login(page, fixture("betavip").users.ches!);
  await page.goto(`/admin/rehearsals/${publication.challengeVersionId}`);
  await expect(page.getByRole("heading", { name: "Fuera de pista" })).toBeVisible();
});

test("publication policy disables and reenables dynamic practice without a fixed association", async ({
  page,
}) => {
  await login(page, fixture("betavip").users.xesmona!);
  const publication = fixture("betavip").data.publications[3]!;
  await page.goto(`/admin/challenges/${publication.challengeId}`);
  const panel = page.getByRole("region", { name: "Pruebas del desafío" });
  await panel.getByRole("combobox", { name: "Pruebas habilitadas" }).selectOption("false");
  await panel.getByRole("textbox", { name: "Motivo" }).fill("Comprobación de política dinámica");
  await panel.getByRole("button", { name: "Guardar disponibilidad" }).click();
  await expect(panel.getByRole("combobox", { name: "Pruebas habilitadas" })).toHaveValue("false");
  await page.context().clearCookies();
  await login(page, fixture("betavip").users.ches!);
  await page.goto(`/desafios/${publication.id}/prueba?roomId=beta-vip`);
  await expect(page.getByRole("heading", { name: "Prueba no disponible" })).toBeVisible();
  await page.context().clearCookies();
  await login(page, fixture("betavip").users.xesmona!);
  await page.goto(`/admin/challenges/${publication.challengeId}`);
  await panel.getByRole("combobox", { name: "Pruebas habilitadas" }).selectOption("true");
  await panel
    .getByRole("textbox", { name: "Motivo" })
    .fill("Reactivación tras comprobar la política");
  await panel.getByRole("button", { name: "Guardar disponibilidad" }).click();
  await expect(panel.getByRole("combobox", { name: "Pruebas habilitadas" })).toHaveValue("true");
});

test("question difficulty survives publication and changes only in a new version", async ({
  page,
}) => {
  await login(page, fixture("betavip").users.xesmona!);
  await page.goto("/admin/questions/new");
  await page.getByLabel("Documento standalone (sin points)").fill(
    JSON.stringify({
      slug: `e2e-difficulty-${Date.now()}`,
      type: "true-false",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      publicPayload: { question: "Una semana tiene siete días." },
      solutionPayload: { correctAnswer: true, explanation: "Una semana comprende siete días." },
    }),
  );
  await expect(page.getByLabel("Dificultad")).toHaveValue("medium");
  await page.getByLabel("Dificultad").selectOption("hard");
  const create = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Crear borrador", exact: true }) });
  await create
    .getByLabel("Motivo de auditoría")
    .fill("Clasificación inicial para comprobar dificultad");
  await create.getByRole("button", { name: "Crear borrador", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/questions\/[a-f0-9-]{36}$/);
  const publishedId = page.url().split("/").at(-1)!;
  await expect(page.getByLabel("Dificultad")).toHaveValue("hard");
  const publish = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Publicar versión", exact: true }) });
  await publish.getByLabel("Motivo de auditoría").fill("Publicar dificultad explícita");
  await publish.getByRole("button", { name: "Publicar versión", exact: true }).click();
  await expect(page.getByRole("button", { name: "Crear nueva versión" })).toBeVisible();
  await expect(page.getByLabel("Dificultad")).toHaveValue("hard");
  await page.getByLabel("Dificultad").selectOption("easy");
  const next = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Crear nueva versión", exact: true }) });
  await next.getByLabel("Motivo de auditoría").fill("Cambiar dificultad en una versión nueva");
  await next.getByRole("button", { name: "Crear nueva versión", exact: true }).click();
  await expect.poll(() => page.url().split("/").at(-1)).not.toBe(publishedId);
  await expect(page.getByLabel("Dificultad")).toHaveValue("easy");
  expect(
    await sqlCount(
      `select count(*) from private.question_versions where id='${publishedId}' and difficulty='hard' and status='published'`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from private.question_versions where id='${page.url().split("/").at(-1)!}' and difficulty='easy' and status='draft'`,
    ),
  ).toBe(1);
});
