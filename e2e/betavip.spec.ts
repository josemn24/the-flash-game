import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { sqlCount } from "../scripts/support/supabase-local.mjs";

type Account = { email: string; password: string; playerId: string };
type Fixture = {
  users: { ches: Account };
  data: {
    room: { slug: string };
    publicationId: string;
    challengeVersionId: string;
    steelBallRunPublicationId: string;
    publications: Array<{ id: string; number: number; title: string; mode: string }>;
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

test("Ches juega la primera letra de La vuelta al mundo en BetaVIP", async ({ page }) => {
  test.setTimeout(90_000);
  const data = await fixture();
  expect(data.data.publicationId).toBe(data.data.publications[0]?.id);
  expect(data.data.publications.map(({ number, title, mode }) => [number, title, mode])).toEqual([
    [1, "La vuelta al mundo", "alphabet"],
    [2, "Steel Ball Run", "flash"],
  ]);
  await signIn(page, data.users.ches);

  await expect(page.getByRole("link", { name: /Abrir sala Tabarnia/ })).toBeVisible();
  await page.getByRole("link", { name: /Abrir sala BetaVIP/ }).click();
  await expect(page.getByRole("heading", { name: "BetaVIP", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "La vuelta al mundo" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(
    page.getByRole("heading", { name: "Conjunto de islas próximas entre sí." }),
  ).toBeVisible();
  await page.getByLabel("Tu respuesta").fill("archipiélago");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByRole("status").getByText("Correcto")).toBeVisible();

  const attemptFilter = `player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${data.data.publicationId}' and challenge_version_id = '${data.data.challengeVersionId}'`;
  await expect
    .poll(() => sqlCount(`select count(*) from public.attempts where ${attemptFilter};`))
    .toBe(1);
  expect(
    await sqlCount(
      `select count(*) from private.attempt_answers answer join public.attempts attempt on attempt.id = answer.attempt_id join private.challenge_items item on item.id = answer.challenge_item_id where attempt.player_id = '${data.users.ches.playerId}' and attempt.scheduled_challenge_id = '${data.data.publicationId}' and item.position = 1 and answer.status = 'correct';`,
    ),
  ).toBe(1);
  expect(
    await sqlCount(
      `select count(*) from public.attempts where player_id = '${data.users.ches.playerId}' and scheduled_challenge_id = '${data.data.steelBallRunPublicationId}';`,
    ),
  ).toBe(0);
});
