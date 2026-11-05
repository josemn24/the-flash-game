import { loseGameplayConfirmations } from "./support/lost-confirmations";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql } from "../scripts/support/supabase-local.mjs";

type Fixture = {
  users: {
    alice: { email: string; password: string };
    bob: { email: string; password: string };
    carol: { email: string; password: string };
    dave: { email: string; password: string };
    erin: { email: string; password: string };
    frank: { email: string; password: string };
  };
  data: {
    room: { slug: string };
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s03.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openFlash(page: Page, account: { email: string; password: string }) {
  await signIn(page, account);
  await page.getByRole("link", { name: /Abrir sala Sala competitiva S03/ }).click();
  const challengeLink = page.getByRole("link", { name: /^(Jugar|Continuar)$/ });
  await expect(challengeLink).toHaveAttribute("href", /\/desafios\/[^/]+\?roomId=/);
  await challengeLink.click();
  await expect(page).toHaveURL(/\/desafios\/[^/]+\?roomId=/, { timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: /^(Empezar desafío|Continuar aquí)$/ }),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Flash competitivo" })).toBeVisible();
  const startButton = page.getByRole("button", { name: "Empezar desafío" });
  if (await startButton.count()) await startButton.click();
}

test.describe("S03 — Flash competitivo persistido", () => {
  test("completa dos preguntas, persiste el resultado y lo conserva tras recargar", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const verifyConfirmations = await loseGameplayConfirmations(page);
    const data = await fixture();
    await openFlash(page, data.users.alice);
    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible({
      timeout: 20_000,
    });
    expect(await page.content()).not.toContain("Lisboa es la capital de Portugal");

    await page.getByRole("button", { name: "Lisboa" }).dblclick();
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
    await page.getByRole("button", { name: "Marte" }).dblclick();

    await expect(page.locator("#challenge-result-title")).toBeVisible();
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();
    expect(await page.content()).not.toContain("S03_PRIVATE");

    await page.reload();
    await expect(page.locator("#challenge-result-title")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").first().locator("summary").click();
    await expect(page.getByText("Lisboa es la capital de Portugal")).toBeVisible();
    await verifyConfirmations();
  });

  test("persiste un resultado válido con score cero", async ({ page }) => {
    let failureResponses = 2;
    const requestBodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/competitive/attempts/*/answer", async (route) => {
      requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (failureResponses === 0) return route.continue();
      failureResponses--;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "s03-lost-response" } }),
      });
      await response.body();
    });

    await openFlash(page, (await fixture()).users.carol);
    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Oporto" }).click();
    await expect.poll(() => requestBodies.length).toBe(2);
    await expect(page.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Oporto" })).toHaveCount(0);
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect.poll(() => requestBodies.length).toBe(3);
    expect(requestBodies[2]).toEqual(requestBodies[0]);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
    await page.getByRole("button", { name: "Venus" }).click();
    await expect(page.locator("#challenge-result-title")).toBeVisible();
    await expect(page.getByText(/0\/100 puntos/)).toBeVisible();
  });

  test("transfiere explícitamente el control entre dos contextos y bloquea al anterior", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    const data = await fixture();
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    let takeoverRequests = 0;
    const takeoverBodies: Record<string, unknown>[] = [];
    let attemptId = "";
    await secondPage.route("**/api/competitive/attempts/*/takeover", async (route) => {
      takeoverRequests++;
      takeoverBodies.push(route.request().postDataJSON());
      attemptId = new URL(route.request().url()).pathname.split("/").at(-2)!;
      const response = await route.fetch();
      if (takeoverRequests === 1) {
        await response.body();
        await route.abort("failed");
        return;
      }
      await route.fulfill({ response });
    });

    try {
      await openFlash(page, data.users.erin);
      await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible({
        timeout: 20_000,
      });
      await openFlash(secondPage, data.users.erin);
      await expect(secondPage.getByRole("button", { name: "Continuar aquí" })).toBeVisible();
      await secondPage.getByRole("button", { name: "Continuar aquí" }).click();
      await expect.poll(() => takeoverRequests).toBe(2);
      expect(takeoverBodies[1]).toEqual(takeoverBodies[0]);
      expect(attemptId).toMatch(/^[a-f0-9]{8}-[a-f0-9-]{27}$/);
      await expect(secondPage.getByRole("heading", { name: /planeta rojo/ })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByRole("button", { name: "Lisboa" }).click();
      await expect(page.getByText("Has continuado esta partida en otro dispositivo")).toBeVisible({
        timeout: 10_000,
      });

      await secondPage.getByRole("button", { name: "Marte" }).click();
      await expect(secondPage.locator("#challenge-result-title")).toBeVisible();
      const { stdout } = await dockerSql(`select jsonb_build_object(
        'attempts', (select count(*) from public.attempts other where other.player_id=a.player_id and other.scheduled_challenge_id=a.scheduled_challenge_id),
        'controllers', (select count(*) from private.attempt_sessions where attempt_id=a.id and revoked_at is null),
        'revokedControllers', (select count(*) from private.attempt_sessions where attempt_id=a.id and revoked_at is not null),
        'accreditations', (select count(*) from private.flash_point_entries where attempt_id=a.id and entry_type='accreditation'),
        'score', a.score,
        'points', (select sum(amount) from private.flash_point_entries where attempt_id=a.id)
      ) from public.attempts a where a.id='${attemptId}'::uuid;`);
      const persisted = JSON.parse(stdout.trim());
      expect(persisted).toMatchObject({ attempts: 1, controllers: 0, accreditations: 1 });
      expect(persisted.revokedControllers).toBeGreaterThanOrEqual(2);
      expect(persisted.points).toBe(persisted.score);
    } finally {
      await secondContext.close();
    }
  });

  test("convierte el timeout de una pregunta en una respuesta persistida", async ({ page }) => {
    test.setTimeout(90000);
    await openFlash(page, (await fixture()).users.dave);
    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("heading", { name: "Tiempo agotado" })).toBeVisible({
      timeout: 75_000,
    });
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
    await page.getByRole("button", { name: "Venus" }).click();
    await expect(page.locator("#challenge-result-title")).toBeVisible();
    await expect(page.getByText(/0\/100 puntos/)).toBeVisible();
  });

  test("el spectator puede consultar la sala pero no iniciar el competitivo", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva S03/ }).click();
    await expect(page.getByRole("link", { name: "Ver introducción" })).toBeVisible();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash competitivo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
