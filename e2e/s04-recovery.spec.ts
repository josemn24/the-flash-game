import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql } from "../scripts/support/supabase-local.mjs";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: {
    alice: FixtureAccount;
    bob: FixtureAccount;
    carol: FixtureAccount;
  };
  data: {
    room: { slug: string };
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s04.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openFlash(page: Page, account: FixtureAccount) {
  await signIn(page, account);
  await page.getByRole("link", { name: /Abrir sala Sala competitiva S04/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash recuperación S04" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
}

test.describe("S04 — recuperación y abandono de Flash", () => {
  test("recupera el intento tras recargar y conserva la revisión terminal", async ({ page }) => {
    test.setTimeout(60_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);
    expect(await page.content()).not.toContain("S04_EXPLANATION");

    await page.reload();
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Marte" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").nth(1).locator("summary").click();
    await expect(
      page.getByText("S04_EXPLANATION_TWO: Marte recibe el nombre de planeta rojo."),
    ).toBeVisible();
  });

  test("mantiene al spectator fuera del competitivo", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva S04/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash recuperación S04" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
    expect(await page.content()).not.toContain("S04_EXPLANATION");
  });

  test("bloquea una segunda sesión y no muestra una acción de abandono", async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    const data = await fixture();
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();

    try {
      await openFlash(page, data.users.carol);
      await signIn(secondPage, data.users.carol);

      const blocked = await secondPage.evaluate(async (scheduledChallengeId) => {
        await fetch("/api/competitive/attempts/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scheduledChallengeId }),
        });
        const response = await fetch("/api/competitive/attempts/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scheduledChallengeId,
            idempotencyKey: "s04-second-device-start",
          }),
        });
        return { status: response.status, body: await response.json() };
      }, data.data.publicationId);

      expect(blocked.status).toBe(409);
      expect(blocked.body.error).toMatchObject({ code: "attempt_control_required" });
      expect(blocked.body.error.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      await expect(page.getByRole("button", { name: "Abandonar intento" })).toHaveCount(0);

      // Close the publication and backdate activity, preserving its immutable clock.
      // Expire through the real API adapter, not a tick that could mask a rollback.
      const { stdout } = await dockerSql(
        `select id from public.attempts where scheduled_challenge_id='${data.data.publicationId}' and status='in_progress' order by started_at desc limit 1;`,
      );
      const attemptId = stdout.trim();
      expect(attemptId).toMatch(/^[a-f0-9-]{36}$/);
      await dockerSql(
        `begin; update public.attempts set last_activity_at=clock_timestamp()-interval '16 minutes', lock_version=lock_version+1 where id='${attemptId}'; update public.scheduled_challenges set status='closed' where id='${data.data.publicationId}'; commit;`,
      );
      const expired = await page.evaluate(async (id) => {
        const response = await fetch(`/api/competitive/attempts/${id}/prepare`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lockVersion: 3, idempotencyKey: "s04-expiry-through-adapter" }),
        });
        return { status: response.status, body: await response.json() };
      }, attemptId);
      expect(expired.status).toBe(409);
      expect(expired.body.error.code).toBe("attempt_inactivity_expired");
      const durable = await dockerSql(
        `select status || ':' || (select count(*) from private.flash_point_entries where attempt_id=a.id) || ':' || (select count(*) from private.attempt_sessions where attempt_id=a.id and revoked_at is null) from public.attempts a where id='${attemptId}';`,
      );
      expect(durable.stdout.trim()).toBe("abandoned:0:0");
    } finally {
      await secondContext.close();
    }
  });

  test("recupera el abandono guardado aunque se pierda la respuesta y su cookie", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const data = await fixture();
    // Separate publication: the earlier scenarios already consumed the fixture's attempts.
    const created = await dockerSql(`with room as (
      insert into public.rooms(slug,title) values ('s04-abandon-'||gen_random_uuid(), 'S04 abandono') returning id
    ), membership as (
      insert into public.room_memberships(room_id,player_id,role)
      select room.id,m.player_id,'owner' from room
      join public.rooms original on original.slug='${data.data.room.slug}'
      join public.room_memberships m on m.room_id=original.id and m.role='owner' returning room_id
    ), season as (
      insert into public.seasons(room_id,title,status,starts_at,ends_at)
      select room_id,'S04 abandono','active',now()-interval '1 day',now()+interval '2 days' from membership returning id
    ) insert into public.scheduled_challenges(season_id,challenge_version_id,number,status,opens_at,closes_at)
      select season.id,original.challenge_version_id,1,'open',now()-interval '1 minute',now()+interval '1 day'
      from season join public.scheduled_challenges original on original.id='${data.data.publicationId}' returning id;`);
    const publicationId = created.stdout.trim().split("\n")[0];
    expect(publicationId).toMatch(/^[a-f0-9-]{36}$/);
    await signIn(page, data.users.alice);
    const started = await page.evaluate(async (scheduledChallengeId) => {
      const post = (path: string, body: object) =>
        fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      await post("/api/competitive/attempts/session", { scheduledChallengeId });
      return (
        await post("/api/competitive/attempts/start", {
          scheduledChallengeId,
          idempotencyKey: "s04-abandon-start",
        })
      ).json();
    }, publicationId);
    expect(started.attemptId).toMatch(/^[a-f0-9-]{36}$/);
    let saved: Record<string, unknown> | undefined;
    await page.route(`**/api/competitive/attempts/${started.attemptId}/abandon`, async (route) => {
      if (saved) return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      saved = await response.json();
      await route.abort("failed");
    });
    const request = { attemptId: started.attemptId, lockVersion: started.lockVersion };
    const postAbandon = ({ attemptId, lockVersion }: typeof request) =>
      fetch(`/api/competitive/attempts/${attemptId}/abandon`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true, lockVersion }),
      })
        .then(async (response) => ({ status: response.status, body: await response.json() }))
        .catch(() => ({ status: 0, body: null }));
    expect((await page.evaluate(postAbandon, request)).status).toBe(0);
    expect(saved?.status).toBe("abandoned");
    const replay = await page.evaluate(postAbandon, request);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(saved);
    const durable = await dockerSql(`select status || ':' ||
      (select count(*) from private.flash_point_entries where attempt_id=a.id) || ':' ||
      (select count(*) from private.attempt_sessions where attempt_id=a.id and revoked_at is null)
      from public.attempts a where id='${started.attemptId}';`);
    expect(durable.stdout.trim()).toBe("abandoned:0:0");
  });
});
