import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: {
    superadmin: FixtureAccount;
    owner: FixtureAccount;
    member: FixtureAccount;
    interrupted: FixtureAccount;
    spectator: FixtureAccount;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s15.json", "utf8")) as Fixture;
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

async function createRoomAndSeason(page: Page, data: Fixture, suffix: string) {
  const roomTitle = `Sala S15 E2E ${suffix}`;
  const seasonTitle = `Temporada S15 E2E ${suffix}`;
  await page.goto("/admin/rooms");
  await page.getByRole("button", { name: "Crear nueva sala privada" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill(roomTitle);
  await dialog.getByLabel("Descripción").fill("Sala efímera para el recorrido E2E S15");

  const ownerGroup = dialog.getByRole("group", { name: "Propietario inicial" });
  await ownerGroup.getByRole("textbox").fill(data.users.owner.email);
  await ownerGroup.getByRole("button", { name: "Buscar" }).click();
  await expect(ownerGroup.getByText("Owner S15")).toBeVisible();

  const members = [
    { account: data.users.member, role: "member", displayName: "Member S15" },
    { account: data.users.interrupted, role: "member", displayName: "Interrupted S15" },
    { account: data.users.spectator, role: "spectator", displayName: "Spectator S15" },
  ] as const;
  for (const member of members) {
    await dialog.getByRole("button", { name: "Añadir miembro" }).click();
    const row = dialog.locator('[aria-label="Email del miembro"]').last().locator("..");
    await row.getByLabel("Email del miembro").fill(member.account.email);
    await row.getByLabel("Rol del miembro").selectOption(member.role);
    await row.getByRole("button", { name: "Buscar" }).click();
    await expect(row.getByText(member.displayName)).toBeVisible();
  }

  await dialog.getByLabel("Motivo de auditoría").fill("Preparar sala aislada para S15");
  await dialog.getByRole("button", { name: "Crear sala" }).click();
  await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?created=1$/);
  const roomId = page.url().match(/\/admin\/rooms\/([^/?]+)\?created=1$/)?.[1];
  expect(roomId).toBeTruthy();

  await page.goto(`/admin/rooms/${roomId}?tab=seasons`);
  const roomSlugText = await page
    .locator('section[aria-labelledby^="season-room-"] p')
    .first()
    .textContent();
  const roomSlug = roomSlugText?.split("·")[0]?.trim().replace(/^\//, "");
  expect(roomSlug).toBeTruthy();

  await page.getByLabel("Título").fill(seasonTitle);
  const now = Date.now();
  await page.getByLabel("Inicio · Europe/Madrid").fill(madridLocal(new Date(now - 3_600_000)));
  await page.getByLabel("Fin · Europe/Madrid").fill(madridLocal(new Date(now + 86_400_000)));
  await page.getByLabel("Motivo de auditoría").fill("Preparar temporada aislada para S15");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/tab=seasons&season=created$/);
  page.once("dialog", (activation) => activation.accept());
  await page.getByLabel("Motivo de activación").fill("Abrir temporada para la prueba S15");
  await page.getByRole("button", { name: "Activar temporada" }).click();
  await expect(page).toHaveURL(/tab=seasons&season=activated$/);

  return { roomId: roomId as string, roomSlug: roomSlug as string, roomTitle, seasonTitle };
}

test.describe("S15 — La Pirámide competitiva", () => {
  test("publica siete niveles, acredita la cima y recupera un fallo con revisión propia", async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);
    const data = await fixture();
    const suffix = Date.now().toString(36);
    const title = `La Pirámide S15 E2E ${suffix}`;
    const questionSlugSuffix = `s15-${suffix}`;
    const editorialDocument = {
      challenge: {
        slug: `pyramid-s15-e2e-${suffix}`,
        title,
        subtitle: "Siete niveles, una cima",
        description: "Desafío persistido de La Pirámide creado en el portal.",
        mode: "pyramid",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: Array.from({ length: 7 }, (_, index) => ({
        slug: `${questionSlugSuffix}-q${index + 1}`,
        type: "multiple-choice",
        payloadSchemaVersion: 1,
        timeLimitMs: 30_000,
        points: index < 5 ? 14 : 15,
        publicPayload: {
          category: "Lógica",
          tags: {},
          question: `Nivel ${index + 1}: ¿qué color se mezcla con azul para formar violeta?`,
          options: ["Rojo", "Verde"],
          media: null,
          promptVisual: null,
        },
        solutionPayload: {
          correctAnswer: "Rojo",
          explanation: "El rojo mezclado con azul forma violeta.",
        },
        modeConfig: {
          levelId: `level-${index + 1}`,
          label: `Nivel ${index + 1}`,
          briefing: {
            title: `Briefing ${index + 1}`,
            format: "Lógica",
            description: `Resuelve la prueba del nivel ${index + 1} para seguir ascendiendo.`,
          },
        },
      })),
    };

    await signIn(page, data.users.superadmin);
    await page.goto("/admin/challenges/new");
    const editor = page.locator("section[aria-labelledby='editorial-management-title']");
    await editor
      .getByLabel("Documento editorial JSON")
      .fill(JSON.stringify(editorialDocument, null, 2));
    await expect(editor.getByLabel("Previsualización editorial protegida")).toBeVisible();
    await expect(editor.getByText("La Pirámide · 7/7 niveles · 100 puntos")).toBeVisible();
    await editor.getByLabel("Motivo de auditoría").first().fill("Preparar La Pirámide S15");
    await editor.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page).toHaveURL(/\/admin\/challenges\/[^/]+\?editorial=saved$/);
    const challengeUrl = page.url().split("?")[0];

    await page.goto("/admin/questions");
    await page.getByLabel("Buscar").fill(questionSlugSuffix);
    const questionLinks = page.locator("a[href^='/admin/questions/']:not([href$='/new'])");
    await expect(questionLinks).toHaveCount(7);
    const questionHrefs = await questionLinks.evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean),
    );
    for (const href of questionHrefs) {
      await page.goto(href as string);
      await page.getByLabel("Motivo de auditoría").last().fill("Publicar pregunta S15");
      await page.getByRole("button", { name: "Publicar versión" }).click();
    }

    await page.goto(challengeUrl);
    await page.reload();
    await expect(editor.getByText("La Pirámide · 7/7 niveles · 100 puntos")).toBeVisible();
    await editor.getByLabel("Motivo de auditoría").last().fill("Publicar La Pirámide S15");
    page.once("dialog", (dialog) => dialog.accept());
    await editor.getByRole("button", { name: "Publicar versión" }).click();
    await expect(page).toHaveURL(/editorial=published$/);

    const room = await createRoomAndSeason(page, data, suffix);
    await page.goto(`/admin/rooms/${room.roomId}?tab=calendar`);
    await page.getByRole("link", { name: "Calendario", exact: true }).click();
    await page.getByRole("button", { name: "Programar nuevo desafío" }).click();
    const schedule = page.getByRole("dialog");
    const now = Date.now();
    await schedule
      .getByLabel("Temporada activa")
      .selectOption({ label: `${room.roomTitle} · ${room.seasonTitle}` });
    await schedule.getByLabel("Contenido publicado").selectOption({ label: `${title} · v1` });
    await schedule.getByLabel("Apertura").fill(madridLocal(new Date(now - 60_000)));
    await schedule.getByLabel("Cierre").fill(madridLocal(new Date(now + 3_600_000)));
    await schedule.getByLabel("Motivo de auditoría").fill("Programar La Pirámide S15");
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
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const interruptedContext = await browser.newContext();
    const interrupted = await interruptedContext.newPage();
    const spectatorContext = await browser.newContext();
    const spectator = await spectatorContext.newPage();
    try {
      await signIn(member, data.users.member);
      await member.goto(`/salas/${room.roomSlug}`);
      await expect(member.getByRole("heading", { name: title })).toBeVisible();
      await member.getByRole("link", { name: "Jugar" }).click();
      const playableUrl = member.url();
      await expect(member.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
      await member.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(member.getByRole("heading", { name: "Briefing 1" })).toBeVisible();
      await member.reload();
      await expect(member.getByRole("heading", { name: "Briefing 1" })).toBeVisible();
      expect(await member.content()).not.toContain("El rojo mezclado con azul forma violeta.");

      for (let level = 1; level <= 7; level += 1) {
        await expect(member.getByRole("heading", { name: `Briefing ${level}` })).toBeVisible();
        await member.getByRole("button", { name: "Empezar nivel" }).click();
        await expect(
          member.getByRole("heading", { name: /qué color se mezcla con azul para formar violeta/ }),
        ).toBeVisible();
        await expect(member.getByText(`Nivel ${level}:`, { exact: true })).toBeVisible();
        await member.getByRole("button", { name: "Rojo" }).click();
        if (level < 7) {
          await expect(member.getByRole("heading", { name: `Briefing ${level + 1}` })).toBeVisible({
            timeout: 20_000,
          });
        }
      }

      await expect(member.getByRole("heading", { name: "Cima conquistada" })).toBeVisible({
        timeout: 20_000,
      });
      await expect(member.getByText("7 / 7", { exact: true }).first()).toBeVisible();
      await member.reload();
      await expect(member.getByRole("heading", { name: "Cima conquistada" })).toBeVisible();
      const score = Number(
        await member
          .locator('section[aria-labelledby="challenge-result-title"] strong')
          .first()
          .textContent(),
      );
      expect(score).toBe(100);
      await member.getByRole("button", { name: "Ver respuestas" }).click();
      await expect(
        member.getByText("El rojo mezclado con azul forma violeta.").first(),
      ).toBeVisible();
      await member.locator("details").nth(6).locator("summary").click();
      await expect(member.getByText("Nivel 7", { exact: true })).toBeVisible();
      await expect(
        member.getByText("El rojo mezclado con azul forma violeta.").last(),
      ).toBeVisible();
      await expect(member.getByText(/15 puntos ·/).last()).toBeVisible();

      await signIn(owner, data.users.owner);
      await owner.goto(`/salas/${room.roomSlug}`);
      await expect(owner.getByRole("heading", { name: title })).toBeVisible();
      await owner.getByRole("link", { name: "Jugar" }).click();
      await owner.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(owner.getByRole("heading", { name: "Briefing 1" })).toBeVisible();
      await owner.getByRole("button", { name: "Empezar nivel" }).click();
      await expect(
        owner.getByRole("heading", { name: /qué color se mezcla con azul para formar violeta/ }),
      ).toBeVisible();
      await owner.getByRole("button", { name: "Verde" }).click();
      await expect(owner.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible({
        timeout: 20_000,
      });
      await owner.reload();
      await expect(owner.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
      await owner.getByRole("button", { name: "Ver respuestas" }).click();
      await expect(owner.getByText("Nivel 1", { exact: true })).toBeVisible();
      await expect(owner.getByText("Nivel 2", { exact: true })).toHaveCount(0);

      await signIn(interrupted, data.users.interrupted);
      await interrupted.goto(`/salas/${room.roomSlug}`);
      await expect(interrupted.getByRole("heading", { name: title })).toBeVisible();
      await interrupted.getByRole("link", { name: "Jugar" }).click();
      await interrupted.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(interrupted.getByRole("heading", { name: "Briefing 1" })).toBeVisible();
      await interrupted.getByRole("button", { name: "Empezar nivel" }).click();
      await expect(
        interrupted.getByRole("heading", {
          name: /qué color se mezcla con azul para formar violeta/,
        }),
      ).toBeVisible();
      await interrupted.reload();
      await expect(interrupted.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible({
        timeout: 20_000,
      });
      await interrupted.getByRole("button", { name: "Ver respuestas" }).click();
      await expect(interrupted.getByText("Nivel 1", { exact: true })).toBeVisible();
      await expect(interrupted.getByText("Nivel 2", { exact: true })).toHaveCount(0);

      await signIn(spectator, data.users.spectator);
      await spectator.goto(playableUrl);
      await expect(spectator.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
      expect(await spectator.content()).not.toContain(
        "¿qué color se mezcla con azul para formar violeta?",
      );
      expect(await spectator.content()).not.toContain("El rojo mezclado con azul forma violeta.");

      await member.goto(`/salas/${room.roomSlug}/ranking`);
      await expect(member.getByText("Member S15")).toBeVisible();
      await expect(member.getByRole("img", { name: "100 Flash Points" })).toBeVisible();
    } finally {
      await memberContext.close();
      await ownerContext.close();
      await interruptedContext.close();
      await spectatorContext.close();
    }
  });
});
