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

test("BetaVIP muestra La vuelta al mundo como primer desafío", async ({ page }) => {
  const data = await fixture();
  const [alphabet, pyramid, survival] = data.data.publications;
  expect(data.data.publicationId).toBe(alphabet.id);
  expect(data.data.survivalPublicationId).toBe(survival.id);
  expect(data.data.alphabetPublicationId).toBe(alphabet.id);
  expect(data.data.pyramidPublicationId).toBe(pyramid.id);
  expect(data.data.publications.map(({ number, title, mode }) => [number, title, mode])).toEqual([
    [1, "La vuelta al mundo", "alphabet"],
    [2, "Cumbre lógica II", "pyramid"],
    [3, "Supervivencia: Cultura pop", "survival"],
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
      `select count(*) from public.attempts where scheduled_challenge_id in ('${survival.id}', '${alphabet.id}', '${pyramid.id}');`,
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
  const [alphabet, pyramid, survival] = data.data.publications;

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
