import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { betaVipConnectPairsQuestions } from "../scripts/fixtures/scenarios/betavip-connect-pairs.mjs";
import { betaVipTimeTrialQuestions } from "../scripts/fixtures/scenarios/betavip-time-trial.mjs";
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
    connectPairsPublicationId: string;
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

test("BetaVIP empieza por Conectar parejas y permite completar sus seis tableros", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const data = await fixture();
  const [connectPairs, alphabet, pyramid, timeTrial, survival, antiquity] = data.data.publications;
  expect(data.data.connectPairsPublicationId).toBe(connectPairs.id);
  expect(data.data.publicationId).toBe(connectPairs.id);
  expect(data.data.survivalPublicationId).toBe(survival.id);
  expect(data.data.alphabetPublicationId).toBe(alphabet.id);
  expect(data.data.pyramidPublicationId).toBe(pyramid.id);
  expect(data.data.antiquityPublicationId).toBe(antiquity.id);
  expect(data.data.timeTrialPublicationId).toBe(timeTrial.id);
  expect(data.data.publications.map(({ number, title, mode }) => [number, title, mode])).toEqual([
    [1, "Circuito de parejas", "time-trial"],
    [2, "La vuelta al mundo", "alphabet"],
    [3, "Cumbre lógica II", "pyramid"],
    [4, "Escalera de coronas", "time-trial"],
    [5, "Supervivencia: Cultura pop", "survival"],
    [6, "Ecos de la Antigüedad", "pyramid"],
  ]);

  await signIn(page, data.users.ches);
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(
    page.getByRole("heading", { name: "Circuito de parejas", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
  expect(
    await sqlCount(
      `select count(*) from public.attempts where scheduled_challenge_id in ('${connectPairs.id}', '${survival.id}', '${alphabet.id}', '${pyramid.id}', '${antiquity.id}', '${timeTrial.id}');`,
    ),
  ).toBe(0);
  await expect(page.getByText("Une las parejas", { exact: false })).toBeVisible();
  const deadlines: string[] = [];
  page.on("response", async (response) => {
    if (response.url().endsWith("/prepare") && response.ok())
      deadlines.push((await response.json()).deadlineAt);
  });
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  for (const [index, question] of betaVipConnectPairsQuestions.entries()) {
    await expect(page.getByText(`Prueba ${index + 1} de 6`, { exact: true })).toBeVisible({
      timeout: 15000,
    });
    const size = question.publicPayload.grid.rows;
    for (const path of Object.values(question.solutionPayload.paths)) {
      for (const cell of path) {
        await page
          .getByRole("button", {
            name: new RegExp(
              `^Fila ${Math.floor(cell / size) + 1}, columna ${(cell % size) + 1}(?:[:,]|$)`,
            ),
          })
          .click();
      }
    }
  }
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible();
  await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
  expect(deadlines).toHaveLength(6);
  expect(new Set(deadlines).size).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from public.attempts where scheduled_challenge_id = '${connectPairs.id}' and status = 'completed' and score = 100;`,
    ),
  ).toBe(1);
});

test("Ches continúa con Cumbre lógica II en el tercer periodo", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [connectPairs, alphabet, pyramid, , survival] = data.data.publications;
  expect(data.data.publicationId).toBe(connectPairs.id);
  expect(data.data.survivalPublicationId).toBe(survival.id);
  expect(data.data.alphabetPublicationId).toBe(alphabet.id);
  expect(data.data.publications.map(({ number, title, mode }) => [number, title, mode])).toEqual([
    [1, "Circuito de parejas", "time-trial"],
    [2, "La vuelta al mundo", "alphabet"],
    [3, "Cumbre lógica II", "pyramid"],
    [4, "Escalera de coronas", "time-trial"],
    [5, "Supervivencia: Cultura pop", "survival"],
    [6, "Ecos de la Antigüedad", "pyramid"],
  ]);

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id in ('${connectPairs.id}', '${alphabet.id}') and status <> 'cancelled';
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

test("Escalera de coronas: cuarto desafío, un deadline y 100 puntos", async ({ page }) => {
  test.setTimeout(120_000);
  const data = await fixture();
  const [connectPairs, alphabet, pyramid, timeTrial] = data.data.publications;

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id in ('${connectPairs.id}', '${alphabet.id}', '${pyramid.id}') and status <> 'cancelled';
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

  const boards = betaVipTimeTrialQuestions.map((question, index) => ({
    size: question.publicPayload.grid.rows,
    progress: `Prueba ${index + 1} de 6`,
    clicks: question.solutionPayload.solution.filter(
      (cell: number) => !question.publicPayload.prefilledQueens.includes(cell),
    ),
  }));
  for (const [index, board] of boards.entries()) {
    await expect(page.getByText(board.progress, { exact: true })).toBeVisible({ timeout: 15_000 });
    for (const [placement, position] of board.clicks.entries()) {
      const target = queensCell(page, position, board.size);
      await target.press("Space");
      await expect(target).toHaveAccessibleName(/marcada con X/);
      await target.press("Enter");
      if (placement < board.clicks.length - 1) {
        await expect(target).toHaveAccessibleName(/: corona/);
      }
    }
    if (index < boards.length - 1) {
      await expect(page.getByText(boards[index + 1].progress, { exact: true })).toBeVisible({
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

test("Ches responde la imagen progresiva en el quinto periodo de Supervivencia", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [, , pyramid, timeTrial, survival] = data.data.publications;

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id in ('${pyramid.id}', '${timeTrial.id}') and status = 'open';
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

test("Ches abre Ecos de la Antigüedad en el sexto periodo", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [connectPairs, alphabet, pyramid, timeTrial, survival, antiquity] = data.data.publications;

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id in (
  '${connectPairs.id}', '${alphabet.id}', '${pyramid.id}', '${timeTrial.id}', '${survival.id}'
) and status <> 'cancelled';
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
