import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: { superadmin: FixtureAccount; member: FixtureAccount; spectator: FixtureAccount };
  data: { e2eRoomSlug: string };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s14.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

function madridLocal(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

test.describe("S14 — supervivencia competitiva", () => {
  test("crea, programa, recupera una eliminación y muestra resultado y revisión propios", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const data = await fixture();
    const suffix = Date.now().toString(36);
    const title = `Supervivencia S14 E2E ${suffix}`;
    const questionSlugSuffix = `s14-${suffix}`;
    const editorialDocument = {
      challenge: {
        slug: `survival-s14-e2e-${suffix}`,
        title,
        subtitle: "Dos preguntas, una vida",
        description: "Desafío de Supervivencia creado en el portal.",
        mode: "survival",
        configSchemaVersion: 1,
        modeConfig: { lives: 1 },
      },
      questions: [
        {
          slug: `${questionSlugSuffix}-q1`,
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: {
            category: "Cultura",
            tags: {},
            question: "¿Cuál es la capital de Portugal?",
            options: ["Lisboa", "Oporto"],
            media: null,
            promptVisual: null,
          },
          solutionPayload: {
            correctAnswer: "Lisboa",
            explanation: "Lisboa es la capital de Portugal.",
          },
        },
        {
          slug: `${questionSlugSuffix}-q2`,
          type: "multiple-choice",
          payloadSchemaVersion: 1,
          timeLimitMs: 15000,
          points: 50,
          publicPayload: {
            category: "Ciencia",
            tags: {},
            question: "¿Qué planeta es conocido como el planeta rojo?",
            options: ["Marte", "Venus"],
            media: null,
            promptVisual: null,
          },
          solutionPayload: {
            correctAnswer: "Marte",
            explanation: "Marte es conocido como el planeta rojo.",
          },
        },
      ],
    };

    await signIn(page, data.users.superadmin);
    await page.goto("/admin/challenges/new");
    const editor = page.locator("section[aria-labelledby='editorial-management-title']");
    const documentInput = editor.getByLabel("Documento editorial JSON");
    await documentInput.fill(JSON.stringify(editorialDocument, null, 2));
    await expect(editor.getByLabel("Previsualización editorial protegida")).toBeVisible();
    await editor.getByLabel("Motivo de auditoría").first().fill("Preparar Supervivencia S14");
    await editor.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page).toHaveURL(/\/admin\/challenges\/[^/]+\?editorial=saved$/);
    const challengeUrl = page.url().split("?")[0];

    await page.goto("/admin/questions");
    await page.getByLabel("Buscar").fill(questionSlugSuffix);
    const questionLinks = page.locator("a[href^='/admin/questions/']:not([href$='/new'])");
    await expect(questionLinks).toHaveCount(2);
    const questionHrefs = await questionLinks.evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean),
    );
    for (const href of questionHrefs) {
      await page.goto(href as string);
      await page.getByLabel("Motivo de auditoría").last().fill("Publicar pregunta S14");
      await page.getByRole("button", { name: "Publicar versión" }).click();
    }

    await page.goto(challengeUrl);
    await page.reload();
    await expect(editor.getByText("Supervivencia · 2 preguntas · 100 puntos")).toBeVisible();
    await editor.getByLabel("Motivo de auditoría").last().fill("Publicar Supervivencia S14");
    page.once("dialog", (dialog) => dialog.accept());
    await editor.getByRole("button", { name: "Publicar versión" }).click();
    await expect(page).toHaveURL(/editorial=published$/);

    await page.goto("/admin/rooms");
    await page.getByRole("link", { name: "Ver detalle de Sala S14 E2E" }).click();
    await page.getByRole("link", { name: "Calendario", exact: true }).click();
    await page.getByRole("button", { name: "Programar nuevo desafío" }).click();
    const schedule = page.getByRole("dialog");
    const now = Date.now();
    await schedule.getByLabel("Contenido publicado").selectOption({ label: `${title} · v1` });
    await schedule.getByLabel("Apertura").fill(madridLocal(new Date(now - 60_000)));
    await schedule.getByLabel("Cierre").fill(madridLocal(new Date(now + 3_600_000)));
    await schedule.getByLabel("Motivo de auditoría").fill("Programar Supervivencia S14");
    await schedule.getByRole("button", { name: "Programar desafío" }).click();
    await expect(page).toHaveURL(/calendar=created$/);
    const tick = await page.request.post("/api/internal/calendar/tick", {
      headers: {
        authorization: `Bearer ${process.env.CALENDAR_TICK_SECRET ?? "local-s12-calendar-secret"}`,
      },
    });
    expect(tick.ok()).toBeTruthy();

    const memberContext = await browser.newContext();
    const member = await memberContext.newPage();
    const spectatorContext = await browser.newContext();
    const spectator = await spectatorContext.newPage();
    try {
      await signIn(member, data.users.member);
      await member.goto(`/salas/${data.data.e2eRoomSlug}`);
      await expect(member.getByRole("heading", { name: title })).toBeVisible();
      await member.getByRole("link", { name: "Jugar" }).click();
      const playableUrl = member.url();
      await expect(member.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
      await member.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(member.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
      await expect(member.getByLabel("1 de 1 vidas")).toBeVisible();
      expect(await member.content()).not.toContain("Lisboa es la capital de Portugal.");
      await member.getByRole("button", { name: "Lisboa" }).click();
      await expect(member.getByRole("heading", { name: /planeta rojo/ })).toBeVisible({
        timeout: 15_000,
      });
      await member.reload();
      await expect(member.getByText("Has caído en supervivencia.")).toBeVisible({
        timeout: 20_000,
      });
      const score = Number(await member.locator("main").getByText(/^\d+$/).first().textContent());
      expect(score).toBeGreaterThan(0);
      await expect(member.getByText("2 / 2", { exact: true }).first()).toBeVisible();

      await member.reload();
      await expect(member.getByText("Has caído en supervivencia.")).toBeVisible();
      await member.getByRole("button", { name: "Ver respuestas" }).click();
      await expect(member.getByText("Lisboa es la capital de Portugal.")).toBeVisible();
      await member.locator("details").nth(1).locator("summary").click();
      await expect(member.getByText("Marte es conocido como el planeta rojo.")).toBeVisible();

      await signIn(spectator, data.users.spectator);
      await spectator.goto(playableUrl);
      await expect(spectator.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
      expect(await spectator.content()).not.toContain("¿Cuál es la capital de Portugal?");
      expect(await spectator.content()).not.toContain("Lisboa es la capital de Portugal.");

      await member.goto(`/salas/${data.data.e2eRoomSlug}/ranking`);
      await expect(member.getByText("Member S14")).toBeVisible();
      await expect(member.getByRole("img", { name: `${score} Flash Points` })).toBeVisible();
    } finally {
      await memberContext.close();
      await spectatorContext.close();
    }
  });
});
