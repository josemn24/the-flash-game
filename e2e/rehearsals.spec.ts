import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dockerSql, sqlCount } from "../scripts/support/supabase-local.mjs";
import { repositoryRehearsals } from "../scripts/support/rehearsal-catalog.mjs";

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
      rehearsalId: "flash-referencia",
    };
  const publication = fixture("betavip").data.publications[index]!;
  return {
    id: publication.id,
    room: "beta-vip",
    rehearsalId: [
      "betavip-parejas",
      "betavip-alfabeto",
      "betavip-logica",
      "betavip-queens",
      "betavip-supervivencia",
      "betavip-antiguedad",
    ][index]!,
  };
}
async function expectGameReady(page: Page, index: number) {
  await expect(page.getByRole("button", { name: "Empezar prueba" })).toHaveCount(0);
  if (index === 2 || index === 5)
    await expect(page.getByRole("button", { name: "Empezar nivel" })).toBeVisible();
  else await expect(page.getByRole("timer")).toBeVisible();
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
    await page.reload();
    await expectGameReady(page, index);
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
  const selected = await open(page, 3);
  const artifact = repositoryRehearsals().find(
    (a: { ref: { id: string } }) => a.ref.id === selected.rehearsalId,
  )!;
  const writes: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/competitive/attempts"))
      writes.push(request.url());
  });
  for (const [index, q] of artifact.source.questions.entries()) {
    await expect(page.getByText(`Prueba ${index + 1} de 6`, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const size = q.publicPayload.grid.rows;
    for (const cell of q.solutionPayload.solution) {
      if (q.publicPayload.prefilledQueens.includes(cell)) continue;
      await page
        .getByRole("gridcell", {
          name: new RegExp(`Fila ${Math.floor(cell / size) + 1}, columna ${(cell % size) + 1},`),
        })
        .click();
    }
  }
  await reviewAndReturn(page, 3);
  expect(writes).toEqual([]);
});

function artifactFor(index: number) {
  return repositoryRehearsals().find(
    (a: { ref: { id: string } }) => a.ref.id === entry(index).rehearsalId,
  )!;
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

test("Connect Pairs completes and reviews all six practice boards", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, fixture("betavip").users.ches!);
  await open(page, 0);
  const questions = artifactFor(0).source.questions;
  for (const [index, q] of questions.entries()) {
    await expect(page.getByText(`Prueba ${index + 1} de 6`, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
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
  const questions = artifactFor(1).source.questions;
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
  const q = artifactFor(5).source.questions[0];
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
  await page.getByRole("button", { name: "Verdadero", exact: true }).click();
  await page.getByRole("button", { name: "8", exact: true }).click();
  await expect(page.getByLabel("1 de 3 vidas restantes")).toBeVisible();
  await page.getByRole("textbox", { name: "¿Qué aparece en la imagen?" }).fill("incorrecta");
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
  await page.getByRole("button", { name: "Empezar desafío", exact: true }).click();
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
  const questions = artifactFor(6).source.questions;
  await expect(
    page.getByRole("heading", { name: questions[0].publicPayload.question }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: questions[1].publicPayload.question }),
  ).toBeVisible({ timeout: 25_000 });
  await page.goto(`/desafios/${selected.id}?roomId=${selected.room}`);
  await expect(page.getByRole("link", { name: "Probar primero" })).toBeVisible();
});

test("editorial preview is restricted to superadmins and published selections are frozen", async ({
  page,
}) => {
  await login(page, fixture("betavip").users.xesmona!);
  const publication = fixture("betavip").data.publications[3]!;
  await page.goto(`/admin/challenges/${publication.challengeId}`);
  const panel = page.getByRole("region", { name: "Ensayos del desafío" });
  await expect(panel.getByRole("heading", { name: "Pruebas sin competir" })).toBeVisible();
  await expect(panel.getByRole("combobox", { name: "Ensayo compatible" })).toBeDisabled();
  await expect(
    panel.getByText("Esta asociación está publicada y no se puede sustituir."),
  ).toBeVisible();
  await page.goto("/admin/rehearsals/betavip-queens/1");
  await expectGameReady(page, 3);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "output/rehearsal-mobile.png", fullPage: true });
});

test("editorial command associates an existing published version once and refreshes its frozen selection", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page, fixture("betavip").users.ches!);
  await page.goto("/admin/rehearsals/betavip-queens/1");
  await expect(page.getByRole("heading", { name: "Fuera de pista" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar prueba" })).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, fixture("betavip").users.xesmona!);
  const publication = fixture("betavip").data.publications[3]!;
  await dockerSql(`begin;
    insert into private.challenge_versions(id,challenge_definition_id,version_number,config_schema_version,status,mode,title,subtitle,description,max_score,global_time_limit_ms,mode_config,created_by_player_id)
    select md5('rehearsal-browser-legacy')::uuid,challenge_definition_id,2,config_schema_version,'draft',mode,title,subtitle,description,max_score,global_time_limit_ms,mode_config,created_by_player_id
      from private.challenge_versions where id='${publication.challengeVersionId}';
    insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points,config_schema_version,mode_config)
    select md5(id::text||'rehearsal-browser-legacy')::uuid,md5('rehearsal-browser-legacy')::uuid,question_version_id,position,points,config_schema_version,mode_config
      from private.challenge_items where challenge_version_id='${publication.challengeVersionId}';
    update private.challenge_versions set status='published' where id=md5('rehearsal-browser-legacy')::uuid;
    commit;`);
  await page.goto(`/admin/challenges/${publication.challengeId}`);
  const editor = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Ensayo de la versión 2", exact: true }) });
  await editor
    .getByRole("combobox", { name: "Ensayo compatible" })
    .selectOption("betavip-queens@1");
  await editor
    .getByRole("textbox", { name: "Motivo" })
    .fill("Alta expresa de una versión publicada sin ensayo");
  await editor.getByRole("button", { name: "Guardar asociación" }).click();
  await expect(editor.getByRole("combobox", { name: "Ensayo compatible" })).toBeDisabled();
  await expect(
    editor.getByText("Esta asociación está publicada y no se puede sustituir."),
  ).toBeVisible();
  expect(
    await sqlCount(
      "select count(*) from private.challenge_rehearsals where challenge_version_id=md5('rehearsal-browser-legacy')::uuid",
    ),
  ).toBe(1);
});
