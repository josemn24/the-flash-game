import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { connectPairsQuestions } from "../scripts/fixtures/scenarios/time-trial-connect-pairs.mjs";

async function start(page: Page, player: string) {
  const fixture = JSON.parse(
    await readFile("output/fixtures/time-trial-connect-pairs.json", "utf8"),
  );
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users[player].email);
  await page.getByLabel("Contraseña").fill(fixture.users[player].password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: /Abrir sala Sala time-trial-connect-pairs/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByText("Rehaz los caminos libremente", { exact: false })).toBeVisible();
  await expect(page.getByText("Tercer error", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByText("Prueba 1 de 2", { exact: true })).toBeVisible({ timeout: 15000 });
}
function cell(page: Page, questionIndex: number, index: number) {
  const size = connectPairsQuestions[questionIndex].publicPayload.grid.rows;
  return page.getByRole("button", {
    name: new RegExp(
      `^Fila ${Math.floor(index / size) + 1}, columna ${(index % size) + 1}(?:[:,]|$)`,
    ),
  });
}
async function touchCell(page: Page, questionIndex: number, index: number) {
  const bounds = await cell(page, questionIndex, index).boundingBox();
  if (!bounds) throw new Error("Connect Pairs cell is not visible");
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}
async function solve(page: Page, index: number, keyboard = false) {
  for (const path of Object.values(connectPairsQuestions[index].solution.paths)) {
    await cell(page, index, path[0]).click();
    for (let i = 1; i < path.length; i++) {
      if (keyboard) {
        const previous = path[i - 1],
          next = path[i];
        await page.keyboard.press(
          next === previous + 1
            ? "ArrowRight"
            : next === previous - 1
              ? "ArrowLeft"
              : next > previous
                ? "ArrowDown"
                : "ArrowUp",
        );
      } else await cell(page, index, path[i]).click();
    }
  }
}
test("Conectar parejas: edición libre, reloj compartido, puntos y revisión", async ({ page }) => {
  test.setTimeout(90000);
  const deadlines: string[] = [];
  page.on("response", async (response) => {
    if (response.url().endsWith("/prepare") && response.ok())
      deadlines.push((await response.json()).deadlineAt);
  });
  await start(page, "alice");
  await expect(page.getByRole("grid", { name: /4×4/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await cell(page, 0, 0).click();
  await cell(page, 0, 1).click();
  await page.getByRole("button", { name: "Borrar ruta" }).click();
  await expect(page.getByText(/intentos restantes/)).toHaveCount(0);
  let releaseCheckpoint!: () => void;
  let checkpointCommitted!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseCheckpoint = resolve;
  });
  const committed = new Promise<void>((resolve) => {
    checkpointCommitted = resolve;
  });
  let holdFirst = true;
  await page.route("**/connect-pairs/draft", async (route) => {
    const response = await route.fetch();
    if (holdFirst) {
      holdFirst = false;
      expect(response.ok()).toBe(true);
      checkpointCommitted();
      await held;
    }
    await route.fulfill({ response });
  });
  try {
    await cell(page, 0, 0).click();
    await committed;
    await solve(page, 0);
    await expect(page.getByText("Prueba 2 de 2", { exact: true })).toBeVisible({ timeout: 3500 });
  } finally {
    releaseCheckpoint();
  }
  await expect(page.getByRole("grid", { name: /6×6/ })).toBeVisible();
  expect(deadlines).toHaveLength(2);
  expect(deadlines[0]).toBe(deadlines[1]);
  await solve(page, 1);
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible();
  await expect(page.getByText("2/2", { exact: true })).toBeVisible();
  await expect(page.getByLabel("100 de 100 puntos")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
  const firstReview = page.locator("details").nth(0);
  await firstReview.locator("summary").click();
  await expect(firstReview.getByLabel(/Tablero de conexiones 4×4/)).toBeVisible();
  await expect(firstReview.locator('[class*="connectPairsReviewSubmittedSingleton"]')).toHaveCount(
    0,
  );
  const secondReview = page.locator("details").nth(1);
  await secondReview.locator("summary").click();
  await expect(secondReview.getByLabel(/Tablero de conexiones 6×6/)).toBeVisible();
  await expect(secondReview.locator('[class*="connectPairsReviewSubmittedSingleton"]')).toHaveCount(
    0,
  );
});
test.describe("móvil y teclado", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("recuperar el tablero activo conserva los aciertos anteriores", async ({ page }) => {
    test.setTimeout(90000);
    await start(page, "bob");
    await solve(page, 0, true);
    await expect(page.getByText("Prueba 2 de 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("grid", { name: /6×6/ })).toBeVisible();
    const draftSaved = page.waitForResponse((response) => {
      if (!response.url().endsWith("/connect-pairs/draft") || !response.ok()) return false;
      const body = response.request().postDataJSON() as {
        paths?: Record<string, number[]>;
      };
      return Object.values(body.paths ?? {}).some((path) => path.length > 0);
    });
    await touchCell(page, 1, 0);
    await touchCell(page, 1, 1);
    await draftSaved;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tu recorrido contrarreloj" })).toBeVisible();
    await expect(
      page.getByText("Prueba interrumpida sin respuesta recibida", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("1/2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await expect(page.getByRole("heading", { name: "Historial de respuestas" })).toBeVisible();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    const interruptedReview = page.locator("details").nth(1);
    await interruptedReview.locator("summary").click();
    await expect(
      interruptedReview.getByText("Borrador guardado · sin envío final", { exact: true }),
    ).toBeVisible();
    await expect(
      interruptedReview.locator('[class*="connectPairsReviewSubmittedSingleton"]'),
    ).toHaveCount(1);
  });
});
test("una confirmación perdida reintenta la misma respuesta y avanza una sola vez", async ({
  page,
}) => {
  test.setTimeout(90000);
  await start(page, "carol");
  const requests: unknown[] = [];
  let discard = true;
  await page.route("**/attempts/*/answer", async (route) => {
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (discard) {
      discard = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "command_failed" } }),
      });
    } else await route.fulfill({ response });
  });
  await solve(page, 0);
  await expect(page.getByText("Prueba 2 de 2", { exact: true })).toBeVisible();
  expect(requests.length).toBeGreaterThanOrEqual(2);
  expect(requests[0]).toEqual(requests[1]);
  await solve(page, 1);
  await expect(page.getByRole("heading", { name: "Todas las pruebas resueltas" })).toBeVisible();
});

test("el editor crea y publica un Contrarreloj de Conectar parejas", async ({ page }) => {
  test.setTimeout(90000);
  const fixture = JSON.parse(
    await readFile("output/fixtures/time-trial-connect-pairs.json", "utf8"),
  );
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users.dave.email);
  await page.getByLabel("Contraseña").fill(fixture.users.dave.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.goto("/admin/challenges/new");
  const suffix = Date.now().toString(36);
  const document = {
    challenge: {
      slug: `cp-editor-${suffix}`,
      title: "Caminos Contrarreloj",
      subtitle: "Dos tableros",
      description: "Prueba editorial",
      mode: "time-trial",
      configSchemaVersion: 1,
      modeConfig: {},
      globalTimeLimitMs: 120000,
    },
    questions: connectPairsQuestions.map((q, index) => ({
      slug: `cp-editor-${suffix}-${index}`,
      type: q.type,
      payloadSchemaVersion: 1,
      timeLimitMs: q.timeLimitMs,
      points: q.points,
      publicPayload: q.publicPayload,
      solutionPayload: q.solution,
    })),
  };
  const editor = page.locator("section[aria-labelledby='editorial-management-title']");
  await editor.getByLabel("Documento editorial JSON").fill(JSON.stringify(document));
  await expect(editor.getByLabel("Previsualización editorial protegida")).toBeVisible();
  await editor
    .getByLabel("Motivo de auditoría")
    .first()
    .fill("Crear Conectar parejas Contrarreloj");
  await editor.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/challenges\/[^/]+\?editorial=saved$/);
  const challengeUrl = page.url().split("?")[0];
  await page.goto("/admin/questions");
  await page.getByLabel("Buscar").fill(`cp-editor-${suffix}`);
  const links = page.locator("a[href^='/admin/questions/']:not([href$='/new'])");
  await expect(links).toHaveCount(2);
  const hrefs = await links.evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  for (const href of hrefs) {
    await page.goto(href);
    await page.getByLabel("Motivo de auditoría").last().fill("Publicar tablero Conectar parejas");
    await page.getByRole("button", { name: "Publicar versión" }).click();
    await expect(page).toHaveURL(/\/admin\/questions\/[^/?]+$/);
  }
  await page.goto(challengeUrl);
  await editor
    .getByLabel("Motivo de auditoría")
    .last()
    .fill("Publicar Contrarreloj Conectar parejas");
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "Publicar versión" }).click();
  await expect(page).toHaveURL(/\/admin\/challenges\/[^/]+\?editorial=published$/);
  await expect(editor.getByText("Publicado").first()).toBeVisible();
});
