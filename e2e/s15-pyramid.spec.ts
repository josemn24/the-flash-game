import { expect, test, type Locator, type Page } from "@playwright/test";
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
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const submitButton = document.querySelector('form button[type="submit"]');
    return Boolean(
      submitButton && Object.keys(submitButton).some((key) => key.startsWith("__reactProps$")),
    );
  });
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function solveZip(page: Page) {
  const path = [
    0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22, 23, 24,
  ];
  const cells = page.locator('[role="gridcell"] button');
  for (const cell of path) await cells.nth(cell).click();
}

async function solveEscape(page: Page) {
  const board = page.getByRole("group", { name: "Tablero Escape de Pirámide" });
  const move = async (button: Locator, axis: "x" | "y", distance: number) => {
    const [buttonBox, boardBox] = await Promise.all([button.boundingBox(), board.boundingBox()]);
    expect(buttonBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    const cellSize = (axis === "x" ? boardBox!.width : boardBox!.height) / 6;
    const startX = buttonBox!.x + buttonBox!.width / 2;
    const startY = buttonBox!.y + buttonBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(
      startX + (axis === "x" ? distance * cellSize : 0),
      startY + (axis === "y" ? distance * cellSize : 0),
      { steps: 8 },
    );
    await page.mouse.up();
  };

  await move(page.getByRole("button", { name: /bloque C/ }), "x", -1);
  await move(page.getByRole("button", { name: /bloque A/ }), "y", -1);
  await move(page.getByRole("button", { name: /bloque B/ }), "y", 3);
  await move(page.getByRole("button", { name: /pieza objetivo/ }), "x", 4);
}

async function solveWordHashtag(page: Page) {
  for (const [fromCell, toCell] of [
    [1, 7],
    [5, 13],
    [16, 19],
  ]) {
    const from = page.locator(`[data-word-hashtag-cell="${fromCell}"]`);
    const to = page.locator(`[data-word-hashtag-cell="${toCell}"]`);
    await expect(from).toBeEnabled();
    await from.click();
    await expect(from).toHaveAttribute("aria-selected", "true");
    await to.click();
  }
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
      questions: Array.from({ length: 7 }, (_, index) => {
        const level = index + 1;
        const formatQuestion =
          level === 1
            ? {
                type: "true-false",
                publicPayload: { question: "El agua se congela a 0 °C." },
                solutionPayload: {
                  correctAnswer: true,
                  explanation: "A presión normal, sí.",
                },
              }
            : level === 2
              ? {
                  type: "ordering",
                  publicPayload: {
                    question: "Ordena las letras alfabéticamente.",
                    items: ["A", "C", "B"],
                  },
                  solutionPayload: {
                    correctOrder: ["A", "B", "C"],
                    explanation: "El orden alfabético es A, B, C.",
                  },
                }
              : level === 3
                ? {
                    type: "classification",
                    publicPayload: {
                      question: "Clasifica cada elemento.",
                      items: [{ label: "Gato" }, { label: "Rosa" }],
                      categories: ["Animal", "Planta"],
                    },
                    solutionPayload: {
                      categoriesByItem: { Gato: "Animal", Rosa: "Planta" },
                      explanation: "El gato es un animal y la rosa es una planta.",
                    },
                  }
                : level === 4
                  ? {
                      type: "logic-matrix",
                      publicPayload: {
                        question: "¿Qué pieza completa la matriz?",
                        pieces: [
                          { id: "a", symbol: "A", label: "Pieza A" },
                          { id: "b", symbol: "B", label: "Pieza B" },
                          { id: "c", symbol: "C", label: "Pieza C" },
                          { id: "d", symbol: "D", label: "Pieza D" },
                        ],
                        cells: ["a", "b", "c", "b", "c", "a", "c", "a", null],
                        optionIds: ["d", "a", "b", "c"],
                        showPieceLabels: true,
                      },
                      solutionPayload: {
                        correctOptionId: "d",
                        explanation: "La pieza D completa el patrón.",
                      },
                    }
                  : level === 5
                    ? {
                        type: "zip",
                        publicPayload: {
                          category: "Lógica espacial",
                          tags: {},
                          question: "Une los números en orden y cubre la cuadrícula.",
                          grid: { rows: 5, columns: 5 },
                          checkpoints: [
                            { value: 1, cell: 0 },
                            { value: 2, cell: 4 },
                            { value: 3, cell: 5 },
                            { value: 4, cell: 14 },
                            { value: 5, cell: 15 },
                            { value: 6, cell: 24 },
                          ],
                        },
                        solutionPayload: {
                          solution: [
                            0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15,
                            20, 21, 22, 23, 24,
                          ],
                          explanation:
                            "El camino visita los seis checkpoints y recorre las 25 celdas.",
                        },
                      }
                    : level === 6
                      ? {
                          type: "escape",
                          publicPayload: {
                            category: "Lógica espacial",
                            tags: {},
                            question: "Mueve los bloques para liberar la pieza amarilla.",
                            grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
                            initialBlocks: [
                              {
                                id: "target",
                                kind: "target",
                                orientation: "horizontal",
                                row: 2,
                                column: 0,
                                length: 2,
                              },
                              {
                                id: "a",
                                kind: "obstacle",
                                orientation: "vertical",
                                row: 1,
                                column: 2,
                                length: 2,
                              },
                              {
                                id: "b",
                                kind: "obstacle",
                                orientation: "vertical",
                                row: 0,
                                column: 4,
                                length: 3,
                              },
                              {
                                id: "c",
                                kind: "obstacle",
                                orientation: "horizontal",
                                row: 0,
                                column: 1,
                                length: 2,
                              },
                              {
                                id: "d",
                                kind: "obstacle",
                                orientation: "horizontal",
                                row: 4,
                                column: 1,
                                length: 2,
                              },
                            ],
                            boardLabel: "Tablero Escape de Pirámide",
                          },
                          solutionPayload: {
                            referenceSolution: [
                              { blockId: "c", from: 1, to: 0 },
                              { blockId: "a", from: 1, to: 0 },
                              { blockId: "b", from: 0, to: 3 },
                              { blockId: "target", from: 0, to: 4 },
                            ],
                            optimalMoves: 4,
                            explanation: "Despeja la fila del objetivo y llévalo a la salida.",
                          },
                        }
                      : level === 7
                        ? {
                            type: "word-hashtag",
                            publicPayload: {
                              category: "Lengua",
                              tags: {},
                              question:
                                "Intercambia las letras para completar las cuatro palabras.",
                              grid: { rows: 5, columns: 5 },
                              initialLetters: [
                                null,
                                "G",
                                null,
                                "Q",
                                null,
                                "E",
                                "O",
                                "P",
                                "U",
                                "I",
                                null,
                                "N",
                                null,
                                "Y",
                                null,
                                "R",
                                "A",
                                "U",
                                "M",
                                "E",
                                null,
                                "R",
                                null,
                                "A",
                                null,
                              ],
                              maxMoves: 3,
                            },
                            solutionPayload: {
                              words: {
                                top: "YOGUI",
                                bottom: "REUMA",
                                left: "PONER",
                                right: "QUEMA",
                              },
                              explanation:
                                "Tres intercambios completan YOGUI, REUMA, PONER y QUEMA.",
                            },
                          }
                        : {
                            type: "multiple-choice",
                            publicPayload: {
                              category: "Lógica",
                              tags: {},
                              question: `Nivel ${level}: ¿qué color se mezcla con azul para formar violeta?`,
                              options: ["Rojo", "Verde"],
                              media: null,
                              promptVisual: null,
                            },
                            solutionPayload: {
                              correctAnswer: "Rojo",
                              explanation: "El rojo mezclado con azul forma violeta.",
                            },
                          };
        return {
          slug: `${questionSlugSuffix}-q${level}`,
          ...formatQuestion,
          payloadSchemaVersion: 1,
          timeLimitMs: level === 5 ? 90_000 : level === 6 || level === 7 ? 60_000 : 30_000,
          points: index < 5 ? 14 : 15,
          modeConfig: {
            levelId: `level-${level}`,
            label: `Nivel ${level}`,
            briefing: {
              title: `Briefing ${level}`,
              format: "Lógica",
              description: `Resuelve la prueba del nivel ${level} para seguir ascendiendo.`,
            },
          },
        };
      }),
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
      expect(await member.content()).not.toContain("A presión normal, sí.");

      for (let level = 1; level <= 7; level += 1) {
        await expect(member.getByRole("heading", { name: `Briefing ${level}` })).toBeVisible();
        await member.getByRole("button", { name: "Empezar nivel" }).click();
        if (level === 1) {
          await expect(
            member.getByRole("heading", { name: /agua se congela a 0 °C/ }),
          ).toBeVisible();
          await member.getByRole("button", { name: "Verdadero" }).click();
        } else if (level === 2) {
          await expect(member.getByRole("heading", { name: /Ordena las letras/ })).toBeVisible();
          await member.getByRole("button", { name: "Mover B arriba" }).click();
          await member.getByRole("button", { name: "Confirmar orden" }).click();
        } else if (level === 3) {
          await expect(
            member.getByRole("heading", { name: /Clasifica cada elemento/ }),
          ).toBeVisible();
          await member.getByRole("button", { name: "Clasificar Gato como Animal" }).click();
          await member.getByRole("button", { name: "Clasificar Rosa como Planta" }).click();
          await member.getByRole("button", { name: "Confirmar clasificación" }).click();
        } else if (level === 4) {
          await expect(
            member.getByRole("heading", { name: /Qué pieza completa la matriz/ }),
          ).toBeVisible();
          await member.getByRole("button", { name: "Opción 1: Pieza D" }).click();
        } else if (level === 5) {
          await expect(
            member.getByRole("heading", { name: /Une los números en orden/ }),
          ).toBeVisible();
          expect(await member.content()).not.toContain("El camino visita los seis checkpoints");
          expect(await member.content()).not.toContain('"solution"');
          await solveZip(member);
        } else if (level === 6) {
          await expect(member.getByRole("heading", { name: /Mueve los bloques/ })).toBeVisible();
          expect(await member.content()).not.toContain("referenceSolution");
          expect(await member.content()).not.toContain("optimalMoves");
          await solveEscape(member);
        } else {
          await expect(
            member.getByRole("heading", { name: /Intercambia las letras/ }),
          ).toBeVisible();
          expect(await member.content()).not.toContain('"words"');
          await solveWordHashtag(member);
        }
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
      const reviewExplanations = [
        [0, "A presión normal, sí."],
        [1, "El orden alfabético es A, B, C."],
        [2, "El gato es un animal y la rosa es una planta."],
        [3, "La pieza D completa el patrón."],
        [4, "El camino visita los seis checkpoints y recorre las 25 celdas."],
        [5, "Despeja la fila del objetivo y llévalo a la salida."],
        [6, "Tres intercambios completan YOGUI, REUMA, PONER y QUEMA."],
      ] as const;
      for (const [levelIndex, explanation] of reviewExplanations) {
        const answer = member.locator("details").nth(levelIndex);
        if (levelIndex > 0) {
          await answer.locator("summary").click();
        }
        await expect(answer.getByText(explanation, { exact: false })).toBeVisible();
      }
      const seventhAnswer = member.locator("details").nth(6);
      await expect(seventhAnswer.getByText("Nivel 7", { exact: true })).toBeVisible();
      await expect(seventhAnswer.getByText(/15 puntos ·/)).toBeVisible();

      await signIn(owner, data.users.owner);
      await owner.goto(`/salas/${room.roomSlug}`);
      await expect(owner.getByRole("heading", { name: title })).toBeVisible();
      await owner.getByRole("link", { name: "Jugar" }).click();
      await owner.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(owner.getByRole("heading", { name: "Briefing 1" })).toBeVisible();
      await owner.getByRole("button", { name: "Empezar nivel" }).click();
      await expect(owner.getByRole("heading", { name: /agua se congela a 0 °C/ })).toBeVisible();
      await owner.getByRole("button", { name: "Verdadero" }).click();
      await expect(owner.getByRole("heading", { name: "Briefing 2" })).toBeVisible();
      await owner.getByRole("button", { name: "Empezar nivel" }).click();
      await owner.getByRole("button", { name: "Mover B arriba" }).click();
      await owner.getByRole("button", { name: "Confirmar orden" }).click();
      await expect(owner.getByRole("heading", { name: "Briefing 3" })).toBeVisible();
      await owner.getByRole("button", { name: "Empezar nivel" }).click();
      await owner.getByRole("button", { name: "Clasificar Gato como Animal" }).click();
      await owner.getByRole("button", { name: "Clasificar Rosa como Animal" }).click();
      await owner.getByRole("button", { name: "Confirmar clasificación" }).click();
      await expect(owner.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible({
        timeout: 20_000,
      });
      await owner.reload();
      await expect(owner.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
      await expect(
        owner.locator('section[aria-labelledby="challenge-result-title"] strong').first(),
      ).toHaveText("28");
      await owner.getByRole("button", { name: "Ver respuestas" }).click();
      const thirdAnswer = owner.locator("details").nth(2);
      await thirdAnswer.locator("summary").click();
      await expect(thirdAnswer.getByText("Parcial", { exact: true })).toBeVisible();
      await expect(thirdAnswer.getByText(/0 puntos ·/)).toBeVisible();
      await expect(owner.getByText("Nivel 1", { exact: true })).toBeVisible();
      await expect(owner.getByText("Nivel 2", { exact: true })).toBeVisible();
      await expect(owner.getByText("Nivel 3", { exact: true })).toBeVisible();
      await expect(owner.getByText("Nivel 4", { exact: true })).toHaveCount(0);

      await signIn(interrupted, data.users.interrupted);
      await interrupted.goto(`/salas/${room.roomSlug}`);
      await expect(interrupted.getByRole("heading", { name: title })).toBeVisible();
      await interrupted.getByRole("link", { name: "Jugar" }).click();
      await interrupted.getByRole("button", { name: "Empezar desafío" }).click();
      await expect(interrupted.getByRole("heading", { name: "Briefing 1" })).toBeVisible();
      await interrupted.getByRole("button", { name: "Empezar nivel" }).click();
      await expect(
        interrupted.getByRole("heading", {
          name: /agua se congela a 0 °C/,
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
        "Une los números en orden y cubre la cuadrícula.",
      );
      expect(await spectator.content()).not.toContain(
        "Mueve los bloques para liberar la pieza amarilla.",
      );
      expect(await spectator.content()).not.toContain(
        "Intercambia las letras para completar las cuatro palabras.",
      );
      expect(await spectator.content()).not.toContain("referenceSolution");
      expect(await spectator.content()).not.toContain('"words"');

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
