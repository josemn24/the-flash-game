import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql, sqlCount } from "../scripts/support/supabase-local.mjs";

type Account = { email: string; password: string; playerId: string };
type Publication = {
  id: string;
  number: number;
  title: string;
  mode: string;
  challengeVersionId: string;
};
type Fixture = {
  users: { ches: Account };
  data: {
    room: { slug: string };
    publicationId: string;
    challengeVersionId: string;
    pyramidPublicationId: string;
    alphabetPublicationId: string;
    survivalPublicationId: string;
    antiquityPublicationId: string;
    timeTrialPublicationId: string;
    publications: Publication[];
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/betavip.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: Account) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

function queensCell(page: Page, index: number, size: number) {
  return page.getByRole("gridcell", {
    name: new RegExp(`Fila ${Math.floor(index / size) + 1}, columna ${(index % size) + 1},`),
  });
}

test("BetaVIP muestra La vuelta al mundo como primer desafío", async ({ page }) => {
  const data = await fixture();
  const [alphabet, pyramid, survival, antiquity, timeTrial] = data.data.publications;
  expect(data.data.publicationId).toBe(alphabet.id);
  expect(data.data.survivalPublicationId).toBe(survival.id);
  expect(data.data.alphabetPublicationId).toBe(alphabet.id);
  expect(data.data.pyramidPublicationId).toBe(pyramid.id);
  expect(data.data.antiquityPublicationId).toBe(antiquity.id);
  expect(data.data.timeTrialPublicationId).toBe(timeTrial.id);
  expect(data.data.publications.map(({ number, title, mode }) => [number, title, mode])).toEqual([
    [1, "La vuelta al mundo", "alphabet"],
    [2, "Cumbre lógica II", "pyramid"],
    [3, "Supervivencia: Cultura pop", "survival"],
    [4, "Ecos de la Antigüedad", "pyramid"],
    [5, "Escalera de coronas", "time-trial"],
  ]);

  await signIn(page, data.users.ches);
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(
    page.getByRole("heading", { name: "La vuelta al mundo", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  expect(
    await sqlCount(
      `select count(*) from public.attempts where scheduled_challenge_id in ('${survival.id}', '${alphabet.id}', '${pyramid.id}', '${antiquity.id}', '${timeTrial.id}');`,
    ),
  ).toBe(0);
});

test("Ches continúa con Cumbre lógica II en el segundo periodo", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [alphabet, pyramid, survival] = data.data.publications;
  expect(data.data.publicationId).toBe(alphabet.id);
  expect(data.data.survivalPublicationId).toBe(survival.id);
  expect(data.data.alphabetPublicationId).toBe(alphabet.id);
  expect(data.data.publications.map(({ number, title, mode }) => [number, title, mode])).toEqual([
    [1, "La vuelta al mundo", "alphabet"],
    [2, "Cumbre lógica II", "pyramid"],
    [3, "Supervivencia: Cultura pop", "survival"],
    [4, "Ecos de la Antigüedad", "pyramid"],
    [5, "Escalera de coronas", "time-trial"],
  ]);

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id = '${alphabet.id}';
update public.scheduled_challenges
set opens_at = (select starts_at from public.seasons where id = season_id),
    closes_at = clock_timestamp() + interval '1 hour'
where id = '${pyramid.id}';
set local role service_role;
select private.run_calendar_tick_command('{"runId":"betavip-e2e-pyramid"}'::jsonb);
commit;
`);

  expect(
    await sqlCount(
      `select count(*) from public.scheduled_challenges where id = '${pyramid.id}' and status = 'open';`,
    ),
  ).toBe(1);
  await signIn(page, data.users.ches);
  await expect(page.getByRole("link", { name: /Abrir sala Tabarnia/ })).toBeVisible();
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await expect(page.getByRole("heading", { name: "BetaVIP", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Cumbre lógica II", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("list", { name: "Niveles de La Pirámide" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Une los puntos en orden y cubre todo el tablero." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Empezar nivel" }).click();
  await expect(
    page.getByRole("heading", { name: "Une los puntos en orden y cubre todo el tablero." }),
  ).toBeVisible();
  expect(
    await sqlCount(
      `select count(*) from public.attempts where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${pyramid.id}' and challenge_version_id = '${pyramid.challengeVersionId}';`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from public.attempts where scheduled_challenge_id in ('${alphabet.id}', '${survival.id}');`,
    ),
  ).toBe(0);
});

test("Ches responde la imagen progresiva en el tercer periodo de Supervivencia", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [, pyramid, survival] = data.data.publications;

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id = '${pyramid.id}' and status = 'open';
update public.scheduled_challenges
set opens_at = (select starts_at from public.seasons where id = season_id),
    closes_at = clock_timestamp() + interval '1 hour'
where id = '${survival.id}';
set local role service_role;
select private.run_calendar_tick_command('{"runId":"betavip-e2e-survival"}'::jsonb);
commit;
`);
  expect(
    await sqlCount(
      `select count(*) from public.scheduled_challenges where id = '${survival.id}' and status = 'open';`,
    ),
  ).toBe(1);

  await signIn(page, data.users.ches);
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Cultura pop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(
    page.getByRole("heading", { name: /DeLorean es la máquina del tiempo/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("3 de 3 vidas")).toBeVisible();
  await page.getByRole("button", { name: "Verdadero" }).click();
  await expect(page.getByRole("heading", { name: /cafetería donde se reúnen/ })).toBeVisible();
  await page.getByRole("button", { name: "Central Perk" }).click();
  await expect(page.getByRole("heading", { name: /soporte de audio aparece/ })).toBeVisible();
  const picture = page.getByRole("img", { name: /Fotografía de tres soportes de audio/ });
  await expect(picture).toBeVisible();
  await expect
    .poll(() =>
      picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1200),
    )
    .toBe(true);
  await page.getByLabel("¿Qué aparece en la imagen?").fill("cassette");
  const answerResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && /\/attempts\/[^/]+\/answer$/.test(response.url()),
  );
  await page.getByRole("button", { name: "Enviar respuesta", exact: true }).click();
  expect((await answerResponse).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /En Tetris se completan líneas/ })).toBeVisible();
  await expect(page.getByLabel("3 de 3 vidas")).toBeVisible();
  expect(
    await sqlCount(
      `select count(*) from public.attempts where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${survival.id}' and challenge_version_id = '${survival.challengeVersionId}';`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from private.attempt_answers answer join public.attempts attempt on attempt.id = answer.attempt_id join private.challenge_items item on item.id = answer.challenge_item_id where attempt.player_id = '${data.users.ches.playerId}' and attempt.scheduled_challenge_id = '${survival.id}' and item.position = 3 and answer.status = 'correct';`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from private.attempt_answers answer join public.attempts attempt on attempt.id = answer.attempt_id join private.challenge_items item on item.id = answer.challenge_item_id where attempt.player_id = '${data.users.ches.playerId}' and attempt.scheduled_challenge_id = '${survival.id}' and item.position = 1 and answer.status = 'correct';`,
    ),
  ).toBe(1);
});

test("Ches abre Ecos de la Antigüedad en el cuarto periodo", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [alphabet, pyramid, survival, antiquity] = data.data.publications;

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id in ('${alphabet.id}', '${pyramid.id}', '${survival.id}') and status <> 'cancelled';
update public.scheduled_challenges
set opens_at = (select starts_at from public.seasons where id = season_id),
    closes_at = clock_timestamp() + interval '1 hour'
where id = '${antiquity.id}';
set local role service_role;
select private.run_calendar_tick_command('{"runId":"betavip-e2e-antiquity"}'::jsonb);
commit;
`);

  expect(
    await sqlCount(
      `select count(*) from public.scheduled_challenges where id = '${antiquity.id}' and status = 'open';`,
    ),
  ).toBe(1);
  await signIn(page, data.users.ches);
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(
    page.getByRole("heading", { name: "Ecos de la Antigüedad", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("list", { name: "Niveles de La Pirámide" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Relaciona cada monumento con la civilización que lo construyó.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Empezar nivel" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Relaciona cada monumento con la civilización que lo construyó.",
    }),
  ).toBeVisible();
  expect(
    await sqlCount(
      `select count(*) from public.attempts where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${antiquity.id}' and challenge_version_id = '${antiquity.challengeVersionId}';`,
    ),
  ).toBe(1);
});

test("Ches completa Escalera de coronas con un único deadline y 100 puntos", async ({ page }) => {
  test.setTimeout(120_000);
  const data = await fixture();
  const [alphabet, pyramid, survival, antiquity, timeTrial] = data.data.publications;

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id in ('${alphabet.id}', '${pyramid.id}', '${survival.id}', '${antiquity.id}') and status <> 'cancelled';
update public.scheduled_challenges
set opens_at = (select starts_at from public.seasons where id = season_id),
    closes_at = clock_timestamp() + interval '1 hour'
where id = '${timeTrial.id}';
set local role service_role;
select private.run_calendar_tick_command('{"runId":"betavip-e2e-time-trial"}'::jsonb);
commit;
`);

  expect(
    await sqlCount(
      `select count(*) from public.scheduled_challenges where id = '${timeTrial.id}' and status = 'open';`,
    ),
  ).toBe(1);

  const preparations: Array<Record<string, unknown>> = [];
  page.on("response", async (response) => {
    if (response.url().endsWith("/prepare") && response.ok()) {
      preparations.push(await response.json());
    }
  });
  await signIn(page, data.users.ches);
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(
    page.getByRole("heading", { name: "Escalera de coronas", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/el reloj de 3 min es único para todas las pruebas/i)).toBeVisible();
  await expect(
    page.getByText(/la tercera validación completa incorrecta de un tablero termina el desafío/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();

  const boards = [
    { size: 4, title: /Tablero 1 de 6/, clicks: [7, 8, 14] },
    { size: 5, title: /Tablero 2 de 6/, clicks: [13, 16, 24] },
    { size: 5, title: /Tablero 3 de 6/, clicks: [7, 14, 23] },
    { size: 6, title: /Tablero 4 de 6/, clicks: [9, 22, 26] },
    { size: 6, title: /Tablero 5 de 6/, clicks: [8, 16, 27, 30] },
    { size: 7, title: /Tablero 6 de 6/, clicks: [9, 22, 31, 35] },
  ];
  for (const [index, board] of boards.entries()) {
    await expect(page.getByRole("heading", { name: board.title })).toBeVisible({ timeout: 15_000 });
    for (const position of board.clicks) {
      await queensCell(page, position, board.size).click();
    }
    if (index === 4) {
      await expect(page.getByText("5 resueltas · 72 FP", { exact: true })).toBeVisible();
    }
    if (index < boards.length - 1) {
      await expect(page.getByRole("heading", { name: boards[index + 1].title })).toBeVisible({
        timeout: 15_000,
      });
    }
  }

  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("6/6", { exact: true })).toBeVisible();
  await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
  expect(preparations).toHaveLength(6);
  expect(new Set(preparations.map((preparation) => preparation.deadlineAt)).size).toBe(1);
  expect(JSON.stringify(preparations)).not.toMatch(/solutionPayload|"solution"/);
  expect(
    await sqlCount(
      `select count(*) from public.attempts where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${timeTrial.id}' and challenge_version_id = '${timeTrial.challengeVersionId}' and status = 'completed' and score = 100;`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from private.flash_point_entries where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${timeTrial.id}' and amount = 100;`,
    ),
  ).toBe(1);
});
