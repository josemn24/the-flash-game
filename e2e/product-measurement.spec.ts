import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql } from "../scripts/support/supabase-local.mjs";
import { repositoryRehearsalQuestions } from "../scripts/support/rehearsal-catalog.mjs";
type Fixture = {
  users: Record<string, { email: string; password: string }>;
  data: {
    room: { id: string; slug: string };
    publicationId: string;
    secondRoomId: string;
    secondRoomSlug: string;
  };
};
async function fixture() {
  return JSON.parse(await readFile("output/fixtures/product-measurement.json", "utf8")) as Fixture;
}
async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}
test("records visible usage, saves optional enjoyment with retry, and restricts reports to the operator", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const data = await fixture();
  const commands: string[] = [];
  const rehearsalCompletions: { eventId: string; visitId: string }[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/product/events") && request.method() === "POST") {
      const event = request.postDataJSON();
      if (event.type === "rehearsal_completed") rehearsalCompletions.push(event);
    }
  });
  let failRating = true;
  await page.route("**/api/product/ratings/*", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    commands.push(route.request().postData()!);
    if (failRating) {
      failRating = false;
      await route.fetch();
      return route.abort();
    }
    return route.continue();
  });
  await login(page, data.users.alice);
  await page.goto(`/salas/${data.data.room.slug}`);
  await page.goto(`/desafios/${data.data.publicationId}?roomId=${data.data.room.slug}`);
  await page.getByRole("link", { name: "Probar primero" }).click();
  const recipe = JSON.parse((await page.locator("script[data-rehearsal-recipe]").textContent())!);
  const bank = repositoryRehearsalQuestions();
  for (const ref of recipe.questions as { id: string; version: number }[]) {
    const question = bank.find((q) => q.id === ref.id && q.version === ref.version)!;
    await expect(
      page.getByRole("heading", { name: question.publicPayload.question, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: question.solutionPayload.correctAnswer, exact: true })
      .click();
  }
  await expect(page.getByText("Puntos de prueba", { exact: false })).toBeVisible();
  const runId = recipe.sessionId.replace(
    /^rehearsal-(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    "$1-$2-$3-$4-$5",
  );
  const completions = async () =>
    Number(
      (
        await dockerSql(
          `select count(*) from private.room_measurement_events where type='rehearsal_completed' and visit_id='${runId}';`,
        )
      ).stdout.trim(),
    );
  await expect.poll(completions).toBe(1);
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await page.getByRole("button", { name: "Volver al resultado" }).click();
  await expect(page.getByText("Puntos de prueba", { exact: false })).toBeVisible();
  const returnedIntro = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/product/events") &&
      response.request().method() === "POST" &&
      response.request().postDataJSON().type === "challenge_intro_viewed",
  );
  await page.getByRole("button", { name: "Volver al desafío" }).click();
  await returnedIntro;
  expect(
    new Set(
      rehearsalCompletions.filter((event) => event.visitId === runId).map((event) => event.eventId),
    ).size,
  ).toBe(1);
  expect(await completions()).toBe(1);
  expect(Number((await dockerSql("select count(*) from public.attempts;")).stdout.trim())).toBe(0);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await page.getByRole("button", { name: "Lisboa" }).click();
  await page.getByRole("button", { name: "Marte" }).click();
  await expect(page.locator("#challenge-result-title")).toBeVisible();
  const rating = page.getByRole("region", { name: "Valoración del desafío" });
  await expect(rating.getByRole("radio")).toHaveCount(5);
  await expect(rating.getByRole("radio", { checked: true })).toHaveCount(0);
  await rating.getByRole("radio", { name: "4 de 5 estrellas", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await rating.getByRole("button", { name: "Reintentar valoración" }).click();
  await expect(rating.getByRole("status")).toHaveText("Valoración guardada. Gracias.");
  expect(commands[0]).toBe(commands[1]);
  await page.reload();
  await expect(
    rating.getByRole("radio", { name: "5 de 5 estrellas: muchísimo", exact: true }),
  ).toBeChecked();
  await rating.getByRole("radio", { name: "5 de 5 estrellas: muchísimo", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  const fourStars = rating.getByRole("radio", { name: "4 de 5 estrellas", exact: true });
  await expect(fourStars).toBeChecked();
  await expect(fourStars).toBeFocused();
  const originalViewport = page.viewportSize()!;
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await rating.screenshot({ path: `output/playwright/enjoyment-stars-${width}.png` });
    const stars = await rating.getByRole("radio").all();
    const boxes = await Promise.all(stars.map((star) => star.boundingBox()));
    for (const box of boxes) {
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(1);
    await expect(rating.locator('label[data-filled="true"]')).toHaveCount(4);
  }
  await page.setViewportSize(originalViewport);
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  await page.goto(`/salas/${data.data.room.slug}/ranking`);
  await expect
    .poll(async () =>
      Number(
        (await dockerSql("select count(*) from private.room_measurement_ratings;")).stdout.trim(),
      ),
    )
    .toBe(2);
  await expect
    .poll(async () =>
      Number(
        (
          await dockerSql("select count(distinct type) from private.room_measurement_events;")
        ).stdout.trim(),
      ),
    )
    .toBe(6);
  const admin = await browser.newContext();
  const operator = await admin.newPage();
  await login(operator, data.users.superadmin);
  for (const retiredPath of [
    `/admin/rooms/${data.data.room.id}/experiments`,
    `/admin/rooms/${data.data.room.id}/experiments/${data.data.publicationId}`,
    `/admin/rooms/${data.data.room.id}/experiments/${data.data.publicationId}/export`,
    "/api/internal/product/maintenance",
  ])
    expect((await operator.request.get(retiredPath)).status()).toBe(404);
  await operator.goto(`/admin/rooms/${data.data.room.id}/measurement`);
  await expect(operator.getByRole("heading", { name: "Medición de temporada" })).toBeVisible();
  await expect(operator.getByRole("heading", { name: "Participación por persona" })).toBeVisible();
  await expect(operator.getByRole("button", { name: "Confirmar e iniciar medición" })).toHaveCount(
    0,
  );
  await operator.locator("summary").filter({ hasText: /Alice/ }).click();
  await expect(operator.getByRole("table", { name: /Desafíos de Alice/ })).toContainText(
    "Completado",
  );
  const seasonId = await operator.getByLabel("Temporada", { exact: true }).inputValue();
  const automaticCsv = await operator.request.get(
    `/admin/rooms/${data.data.room.id}/measurement/export?season=${seasonId}&dataset=participation`,
  );
  expect(automaticCsv.ok()).toBe(true);
  expect(automaticCsv.headers()["cache-control"]).toBe("no-store");
  expect(await automaticCsv.text()).toContain('"completed"');
  await operator.screenshot({
    path: "output/playwright/season-measurement-desktop.png",
    fullPage: true,
  });
  expect(
    (
      await page.request.get(
        `/admin/rooms/${data.data.room.id}/measurement/export?season=${seasonId}&dataset=participants`,
      )
    ).status(),
  ).toBe(403);
  expect(
    Number(
      (
        await dockerSql("select count(*) from public.attempts where status='completed';")
      ).stdout.trim(),
    ),
  ).toBe(1);
  await operator.goto(`/admin/rooms/${data.data.secondRoomId}/measurement`);
  await expect(operator.getByText("2 personas incluidas", { exact: false })).toBeVisible();
  await expect(operator.getByText("1 desafíos incluidos", { exact: false })).toBeVisible();
  await page.goto(`/salas/${data.data.secondRoomSlug}`);
  await expect
    .poll(async () =>
      Number(
        (
          await dockerSql(
            `select count(*) from private.room_measurement_events e join private.room_measurements m on m.id=e.measurement_id where m.room_id='${data.data.secondRoomId}' and e.type='room_viewed';`,
          )
        ).stdout.trim(),
      ),
    )
    .toBeGreaterThan(0);
  const denied = await page.request.put(`/api/product/ratings/${data.data.publicationId}`, {
    headers: { Origin: new URL(page.url()).origin },
    data: { id: crypto.randomUUID(), seasonId, value: 4, experimentId: crypto.randomUUID() },
  });
  expect(denied.status()).toBe(400);
  await admin.close();
});

test("persists a visible observation when the browser clock is ahead of the server", async ({
  page,
}) => {
  const data = await fixture();
  await login(page, data.users.alice);
  const ahead = new Date(Date.now() + 30_000);
  await page.clock.setFixedTime(ahead);
  const eventRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/product/events") &&
      request.method() === "POST" &&
      request.postDataJSON().type === "room_viewed",
  );
  await page.goto(`/salas/${data.data.room.slug}`);
  const event = (await eventRequest).postDataJSON();
  expect(event.occurredAt).toBe(ahead.toISOString());
  await expect
    .poll(async () =>
      Number(
        (
          await dockerSql(
            `select count(*) from private.room_measurement_events where event_id='${event.eventId}' and occurred_at>received_at;`,
          )
        ).stdout.trim(),
      ),
    )
    .toBe(1);
});

test("measures automatically before the first admin visit and follows later additions", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const data = await fixture();
  const roomId = data.data.room.id;
  const expectedPeople = Number(
    (
      await dockerSql(
        `select count(*) from public.room_memberships membership join public.players player on player.id=membership.player_id where membership.room_id='${roomId}' and membership.status='active' and membership.role in ('owner','admin','member') and player.status='active' and not exists(select 1 from private.platform_role_assignments op where op.player_id=player.id);`,
      )
    ).stdout.trim(),
  );
  const expectedChallenges = Number(
    (
      await dockerSql(
        `select count(*) from public.scheduled_challenges challenge join public.seasons season on season.id=challenge.season_id where season.room_id='${roomId}' and challenge.status<>'cancelled';`,
      )
    ).stdout.trim(),
  );

  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(data.users.superadmin.email);
  await page.getByLabel("Contraseña").fill(data.users.superadmin.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.goto(`/admin/rooms/${roomId}/measurement`);
  await expect(page.getByRole("heading", { name: "Medición de temporada" })).toBeVisible();
  await expect(
    page.getByText(`${expectedPeople} personas incluidas`, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(`${expectedChallenges} desafíos incluidos`, { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar e iniciar medición" })).toHaveCount(0);
  await expect(page.getByText("Visitas a la sala", { exact: true }).first()).toBeVisible();

  const measurementId = (
    await dockerSql(`select id from private.room_measurements where room_id='${roomId}';`)
  ).stdout.trim();
  expect(measurementId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(
    Number(
      (
        await dockerSql(
          `select count(*) from private.room_measurement_participants where measurement_id='${measurementId}';`,
        )
      ).stdout.trim(),
    ),
  ).toBe(expectedPeople);
  expect(
    Number(
      (
        await dockerSql(
          `select count(*) from private.room_measurement_publications where measurement_id='${measurementId}';`,
        )
      ).stdout.trim(),
    ),
  ).toBe(expectedChallenges);

  const participant = await browser.newContext();
  const participantPage = await participant.newPage();
  await login(participantPage, data.users.alice);
  await participantPage.goto(`/salas/${data.data.room.slug}`);
  await expect
    .poll(async () =>
      Number(
        (
          await dockerSql(
            `select count(distinct visit_id) from private.room_measurement_events where measurement_id='${measurementId}' and type='room_viewed';`,
          )
        ).stdout.trim(),
      ),
    )
    .toBeGreaterThan(0);

  await dockerSql(
    `update public.room_memberships set role='member',updated_at=clock_timestamp() where room_id='${roomId}' and player_id=(select id from public.players where display_name='Bob');
     insert into public.scheduled_challenges(season_id,challenge_version_id,number,status,opens_at,closes_at)
     select season.id,(select challenge_version_id from public.scheduled_challenges where season_id=season.id order by number limit 1),4,'scheduled',now()+interval '10 days',now()+interval '11 days'
     from public.seasons season where season.room_id='${roomId}' order by season.starts_at desc limit 1;`,
  );
  await page.reload();
  await expect(
    page.getByText(`${expectedPeople + 1} personas incluidas`, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(`${expectedChallenges + 1} desafíos incluidos`, { exact: false }),
  ).toBeVisible();
  await participant.close();
});
