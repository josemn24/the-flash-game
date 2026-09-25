import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql, sqlCount } from "../scripts/support/supabase-local.mjs";

type Account = { email: string; password: string; playerId: string };
type Publication = { id: string; number: number; title: string; mode: string };
type Fixture = {
  users: { ches: Account };
  data: {
    room: { slug: string };
    publicationId: string;
    challengeVersionId: string;
    alphabetPublicationId: string;
    steelBallRunPublicationId: string;
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

test("Ches juega primero Supervivencia y carga la imagen progresiva", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [survival, alphabet, steel] = data.data.publications;
  expect(data.data.publicationId).toBe(survival.id);
  expect(data.data.survivalPublicationId).toBe(survival.id);
  expect(data.data.alphabetPublicationId).toBe(alphabet.id);
  expect(data.data.steelBallRunPublicationId).toBe(steel.id);
  expect(data.data.publications.map(({ number, title, mode }) => [number, title, mode])).toEqual([
    [1, "Supervivencia: Cultura pop", "survival"],
    [2, "La vuelta al mundo", "alphabet"],
    [3, "Steel Ball Run", "flash"],
  ]);

  await signIn(page, data.users.ches);
  await expect(page.getByRole("link", { name: /Abrir sala Tabarnia/ })).toBeVisible();
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await expect(page.getByRole("heading", { name: "BetaVIP", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Cultura pop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByLabel("3 de 3 vidas")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /DeLorean es la máquina del tiempo/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Verdadero" }).click();
  await expect(page.getByRole("heading", { name: /cafetería donde se reúnen/ })).toBeVisible();
  await page.getByRole("button", { name: "Central Perk" }).click();
  await expect(page.getByRole("heading", { name: /soporte de audio aparece/ })).toBeVisible();
  const picture = page.getByRole("img", { name: /soporte de audio rectangular con dos carretes/ });
  await expect(picture).toBeVisible();
  await expect
    .poll(() =>
      picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1200),
    )
    .toBe(true);
  expect(
    await sqlCount(
      `select count(*) from public.attempts where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${survival.id}' and challenge_version_id = '${data.data.challengeVersionId}';`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from private.attempt_answers answer join public.attempts attempt on attempt.id = answer.attempt_id join private.challenge_items item on item.id = answer.challenge_item_id where attempt.player_id = '${data.users.ches.playerId}' and attempt.scheduled_challenge_id = '${survival.id}' and item.position = 1 and answer.status = 'correct';`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from public.attempts where scheduled_challenge_id in ('${alphabet.id}', '${steel.id}');`,
    ),
  ).toBe(0);
});

test("Ches juega la primera letra del Alphabet al abrirse el segundo desafío", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixture();
  const [survival, alphabet] = data.data.publications;

  await dockerSql(`
begin;
update public.scheduled_challenges
set status = 'cancelled', cancelled_at = clock_timestamp()
where id = '${survival.id}';
update public.scheduled_challenges
set opens_at = (select starts_at from public.seasons where id = season_id),
    closes_at = clock_timestamp() + interval '1 hour'
where id = '${alphabet.id}';
set local role service_role;
select private.run_calendar_tick_command('{"runId":"betavip-e2e-alphabet"}'::jsonb);
commit;
`);
  expect(
    await sqlCount(
      `select count(*) from public.scheduled_challenges where id = '${alphabet.id}' and status = 'open';`,
    ),
  ).toBe(1);

  await signIn(page, data.users.ches);
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "La vuelta al mundo" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(
    page.getByRole("heading", { name: "Conjunto de islas próximas entre sí." }),
  ).toBeVisible();
  await page.getByLabel("Tu respuesta").fill("archipiélago");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByRole("status").getByText("Correcto")).toBeVisible();

  expect(
    await sqlCount(
      `select count(*) from public.attempts where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${alphabet.id}';`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from private.attempt_answers answer join public.attempts attempt on attempt.id = answer.attempt_id join private.challenge_items item on item.id = answer.challenge_item_id where attempt.player_id = '${data.users.ches.playerId}' and attempt.scheduled_challenge_id = '${alphabet.id}' and item.position = 1 and answer.status = 'correct';`,
    ),
  ).toBe(1);
});
