import { loseGameplayConfirmations } from "./support/lost-confirmations";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dockerSql } from "../scripts/support/supabase-local.mjs";
type Account = { email: string; password: string; playerId: string };
async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s05.json", "utf8")) as {
    users: Record<string, Account>;
    data: {
      timeoutRoom: { slug: string };
      timeoutPublicationId: string;
    };
  };
}
async function open(page: Page, account: Account, roomTitle = "Sala s05") {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: new RegExp(`^Abrir sala ${roomTitle}\\.`) }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}
async function answer(page: Page, value: string) {
  const editor = page.getByRole("textbox", { name: "Tu respuesta" });
  await editor.focus();
  await expect(editor).toHaveAttribute("aria-disabled", "false");
  await editor.pressSequentially(value);
  await page.getByRole("button", { name: "Responder", exact: true }).click();
}

async function switchKeyboard(page: Page, name: "Usar teclado" | "Usar teclado del juego") {
  const size = page.viewportSize();
  // The keyboard switch is intentionally visible only on desktop.
  if (size && size.width <= 640) await page.setViewportSize({ width: 641, height: size.height });
  await page.getByRole("button", { name, exact: true }).click();
  if (size && size.width <= 640) await page.setViewportSize(size);
}

test("Alfabeto conserva pases y vueltas tras recargar y completa el resultado", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  const verifyConfirmations = await loseGameplayConfirmations(page);
  await open(page, (await fixture()).users.alice);
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible({
    timeout: 15000,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
  await page.reload();
  // Recover closes the open letter as a pass under the existing server rules.
  await expect(page.getByRole("heading", { name: "Capital de Australia" })).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Estado de las letras" })
      .getByRole("listitem", { name: "B: Pasada" }),
  ).toBeVisible();
  await answer(page, "Canberra");
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible();
  await answer(page, "armadillo");
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
  await answer(page, "Brasil");
  await expect(page.locator("#challenge-result-title")).toBeVisible();
  await page.reload();
  await expect(page.locator("#challenge-result-title")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(3);
  await verifyConfirmations();
});

test("Alfabeto adapta el editor, el teclado y el tablero al espacio visible", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const preparation = page.waitForResponse(
    (response) => response.url().endsWith("/prepare") && response.ok(),
  );
  await open(page, (await fixture()).users.dave, "Sala s05-ui");
  const payload = await (await preparation).json();
  expect(payload.answerLength).toBe(12);
  expect(payload.publicPayload).not.toHaveProperty("answerLength");
  expect(JSON.stringify(payload)).not.toContain("archipiélago");
  await expect(
    page.getByRole("heading", { name: "Conjunto de islas próximas entre sí" }),
  ).toBeVisible({
    timeout: 15000,
  });
  // The Next development badge covers the space key at this viewport size.
  // Remove development chrome from this layout test and its screenshots.
  await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
  const editor = page.getByRole("textbox", { name: "Tu respuesta" });
  const keyboard = page.getByRole("group", { name: "Teclado del juego" });
  await expect(editor.locator('[data-answer-slot="filled"]')).toHaveCount(0);
  await expect(editor.locator('[data-answer-placeholder="A"]')).toHaveText("A");
  await expect(editor.locator('[data-answer-slot="empty"]')).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Responder", exact: true })).toBeDisabled();
  await page.screenshot({ path: "output/playwright/alphabet-letter-placeholder.png" });
  await editor.pressSequentially("Arma");
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 640, height: 800 },
    { width: 1024, height: 768 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      size.width,
    );
    await expect
      .poll(async () => {
        const box = await page
          .getByRole("button", { name: "Responder", exact: true })
          .boundingBox();
        return box!.y + box!.height;
      })
      .toBeLessThanOrEqual(size.height);
    const respond = await page
      .getByRole("button", { name: "Responder", exact: true })
      .boundingBox();
    expect(respond!.height).toBeGreaterThanOrEqual(44);
    expect(respond!.y + respond!.height).toBeLessThanOrEqual(size.height);
    const board = page.getByRole("list", { name: "Estado de las letras" });
    await expect(board).toBeVisible();
    await expect(board.getByRole("listitem")).toHaveCount(3);
    await expect(board.getByRole("listitem", { name: "A: Activa" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(
      await board.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
      ),
    ).toBe(8);
    await expect(page.getByRole("button", { name: "Ver todas" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (size.height <= 640) {
      await expect(keyboard).toBeHidden();
      await page.getByRole("button", { name: "Mostrar teclado" }).click();
      expect(
        (await keyboard.getByRole("button", { name: "Q", exact: true }).boundingBox())!.height,
      ).toBe(32);
      await page.screenshot({
        path: `output/playwright/alphabet-compact-${size.width}x${size.height}.png`,
      });
      await page.getByRole("button", { name: "Ocultar teclado" }).click();
    } else {
      await expect(keyboard).toBeVisible();
      expect(
        (await keyboard.getByRole("button", { name: "Q", exact: true }).boundingBox())!.height,
      ).toBe(48);
      if (size.width === 320)
        await page.screenshot({
          path: "output/playwright/alphabet-mobile-320.png",
          animations: "disabled",
        });
      if (size.width === 390)
        await page.screenshot({
          path: "output/playwright/alphabet-mobile.png",
          animations: "disabled",
        });
      if (size.width === 1024)
        await page.screenshot({ path: "output/playwright/alphabet-desktop.png" });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const qKey = keyboard.getByRole("button", { name: "Q", exact: true });
  await qKey.focus();
  await qKey.press("Space");
  await expect(editor).toContainText("ArmaQ");
  await keyboard.getByRole("button", { name: "Borrar último carácter" }).click();
  await editor.focus();
  await keyboard.getByRole("button", { name: "Ñ", exact: true }).click();
  await keyboard.getByRole("button", { name: "Espacio" }).click();
  // Playwright's US keyboard inserts non-ASCII text directly into native inputs.
  // A physical Spanish keyboard sends these characters in keydown events instead.
  await editor.dispatchEvent("keydown", { key: "á" });
  await editor.dispatchEvent("keydown", { key: "👨‍👩‍👧‍👦" });
  await keyboard.getByRole("button", { name: "Borrar último carácter" }).click();
  await expect(editor).toBeFocused();
  await expect(editor).toContainText("ArmaÑ á");
  await expect(editor).not.toContainText("👨");
  await switchKeyboard(page, "Usar teclado");
  await expect(editor).toHaveValue("ArmaÑ á");
  await expect(editor).toBeFocused();
  await expect(keyboard).toBeHidden();
  await editor.fill("Una respuesta muy larga con Ñ y acentos: áéíóú ".repeat(3));
  await switchKeyboard(page, "Usar teclado del juego");
  await expect(editor).toContainText("Una respuesta muy larga");
  const cursor = page.locator('[data-answer-slot="caret"]');
  // The effect and ResizeObserver scroll the caret into view after the mode changes.
  await expect
    .poll(async () => {
      const last = await cursor.boundingBox();
      const panel = await editor.boundingBox();
      return Math.max(panel!.y - last!.y, last!.y + last!.height - panel!.y - panel!.height);
    })
    .toBeLessThanOrEqual(0);
  await page.screenshot({ path: "output/playwright/alphabet-long-answer.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: "Mostrar teclado" })).toBeVisible();
  await expect
    .poll(async () => {
      const singleRow = await cursor.boundingBox();
      const compactPanel = await editor.boundingBox();
      return Math.max(
        singleRow!.x + singleRow!.width - compactPanel!.x - compactPanel!.width,
        singleRow!.y + singleRow!.height - compactPanel!.y - compactPanel!.height,
      );
    })
    .toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await switchKeyboard(page, "Usar teclado");
  await editor.fill("arma");
  // Simulate an OS keyboard resize/scroll on the existing VisualViewport listeners.
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 280 },
      offsetTop: { configurable: true, value: 48 },
    });
    viewport.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(async () => {
      const nativeAction = await page
        .getByRole("button", { name: "Responder", exact: true })
        .boundingBox();
      return nativeAction!.y + nativeAction!.height;
    })
    .toBeLessThanOrEqual(328);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(editor).toHaveValue("arma");
  await expect(editor).toBeFocused();
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Reflect.deleteProperty(viewport, "height");
    Reflect.deleteProperty(viewport, "offsetTop");
    viewport.dispatchEvent(new Event("resize"));
  });
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
  await expect(editor).toHaveValue("");
  await editor.fill("Brasil");
  await page.getByRole("button", { name: "Responder", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Capital de Australia" })).toBeVisible();
  await expect(editor).toHaveValue("");
  await editor.fill("Canberra");
  await editor.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Conjunto de islas próximas entre sí" }),
  ).toBeVisible();
  await expect(editor).toBeEnabled();
  await expect(page.getByText("Última pendiente")).toBeVisible();
  await editor.fill("pase repetido");
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  await expect(editor).toHaveValue("");
  await switchKeyboard(page, "Usar teclado del juego");
  await expect(editor).toHaveAttribute("aria-disabled", "false");
  await editor.pressSequentially("Archipielagos");
  await expect(editor.locator('[data-answer-slot="filled"]')).toHaveCount(13);
  await expect(editor.locator('[data-answer-slot="empty"]')).toHaveCount(0);
  const answerResponse = page.waitForResponse(
    (response) => response.url().endsWith("/answer") && response.ok(),
  );
  await editor.press("Enter");
  expect((await (await answerResponse).json()).status).toBe("correct");
  await expect(page.locator("#challenge-result-title")).toBeVisible();
});

test("Alfabeto acepta una alternativa más corta con huecos pendientes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, (await fixture()).users.alice, "Sala s05-ui");
  await expect(
    page.getByRole("heading", { name: "Conjunto de islas próximas entre sí" }),
  ).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Tu respuesta" });
  await expect(editor.locator('[data-answer-slot="filled"]')).toHaveCount(0);
  await expect(editor.locator('[data-answer-placeholder="A"]')).toHaveText("A");
  await expect(editor.locator('[data-answer-slot="empty"]')).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Responder", exact: true })).toBeDisabled();
  await editor.pressSequentially("archipelago");
  await expect(editor.locator('[data-answer-slot="empty"]')).toHaveCount(1);
  await expect(editor).toHaveAccessibleDescription(/11 escritos/);
  const answerResponse = page.waitForResponse(
    (response) => response.url().endsWith("/answer") && response.ok(),
  );
  await page.getByRole("button", { name: "Responder", exact: true }).click();
  expect((await (await answerResponse).json()).status).toBe("correct");
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
});

test("Alfabeto cierra una vez cada letra pendiente tras el deadline global", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  const bodies: Record<string, unknown>[] = [];
  const completions: string[] = [];
  await page.route("**/attempts/*/answer", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.continue();
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/complete")) completions.push(request.url());
  });
  await open(page, (await fixture()).users.bob);
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Estado de las letras" })).toBeVisible();
  await expect(page.locator("#challenge-result-title")).toBeVisible({ timeout: 35000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(bodies).toHaveLength(0);
  expect(completions).toHaveLength(1);
  await page.reload();
  await expect(page.locator("#challenge-result-title")).toBeVisible();
});

test("Alfabeto reintenta preparación y verifica un cierre cuya respuesta se perdió", async ({
  page,
}) => {
  test.setTimeout(60000);
  let failPrepare = true;
  const preparationBodies: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/prepare", async (route) => {
    preparationBodies.push(route.request().postDataJSON());
    if (!failPrepare) {
      await route.continue();
      return;
    }
    failPrepare = false;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await open(page, (await fixture()).users.carol);
  await expect(page.getByRole("heading", { name: "Animal con placas óseas" })).toBeVisible({
    timeout: 15000,
  });
  expect(preparationBodies[1]).toEqual(preparationBodies[0]);
  let loseComplete = true;
  const completionBodies: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/complete", async (route) => {
    completionBodies.push(route.request().postDataJSON());
    if (!loseComplete) {
      await route.continue();
      return;
    }
    loseComplete = false;
    const response = await route.fetch();
    // Forward Set-Cookie from the accepted completion but lose the response body.
    await route.fulfill({
      response,
      status: 503,
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await answer(page, "armadillo");
  await expect(page.getByRole("heading", { name: "País más extenso de Sudamérica" })).toBeVisible();
  await answer(page, "Brasil");
  await expect(page.getByRole("heading", { name: "Capital de Australia" })).toBeVisible();
  await answer(page, "Canberra");
  await expect(page.locator("#challenge-result-title")).toBeVisible({ timeout: 20000 });
  expect(completionBodies[1]).toEqual(completionBodies[0]);
});

test("18 letras conservan la respuesta válida y cierran las pendientes con una petición", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/(answer|complete)$/.test(request.url())) requests.push(request.url());
  });
  const data = await fixture();
  await open(page, data.users.dave, "Sala s05-timeout");
  await expect(page.getByRole("heading", { name: "Pregunta de la letra A" })).toBeVisible();
  const board = page.getByRole("list", { name: "Estado de las letras" });
  await expect(board).toBeVisible();
  await expect(board.getByRole("listitem")).toHaveCount(18);
  expect(
    await board.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(8);
  expect(
    await board.evaluate((element) => getComputedStyle(element).gridTemplateRows.split(" ").length),
  ).toBe(3);
  await page.screenshot({ path: "output/playwright/alphabet-board-18.png" });
  await answer(page, "respuesta");
  await expect(page.locator("#challenge-result-title")).toBeVisible({ timeout: 25000 });
  expect(requests.filter((url) => url.endsWith("/answer"))).toHaveLength(1);
  expect(requests.filter((url) => url.endsWith("/complete"))).toHaveLength(1);
  await expect(page.getByLabel("5 de 100 puntos")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(18);
  await page.reload();
  await expect(page.locator("#challenge-result-title")).toBeVisible();
  await expect(page.getByLabel("5 de 100 puntos")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(18);
  await page.goto("/");
  const room = page.getByRole("link", { name: /^Abrir sala Sala s05-timeout\./ });
  await expect(room.getByRole("img", { name: "5 Flash Points" })).toBeVisible();
});

test("recargar tras el deadline cierra 18 letras sin respuestas automáticas", async ({ page }) => {
  test.setTimeout(45000);
  const data = await fixture();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/answer")) requests.push(request.url());
  });
  const started = page.waitForResponse((response) => response.url().endsWith("/start"));
  await open(page, data.users.bob, "Sala s05-timeout");
  const { deadlineAt } = (await (await started).json()) as { deadlineAt: string };
  const gameUrl = page.url();
  await expect(page.getByRole("heading", { name: "Pregunta de la letra A" })).toBeVisible();
  await page.getByRole("button", { name: "Pasar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta de la letra B" })).toBeVisible();
  await page.goto("/");
  await expect.poll(() => Date.now(), { timeout: 12000 }).toBeGreaterThan(Date.parse(deadlineAt));
  let loseRecovery = true;
  const recoveries: Record<string, unknown>[] = [];
  await page.route("**/attempts/*/recover", async (route) => {
    recoveries.push(route.request().postDataJSON());
    if (!loseRecovery) return route.continue();
    loseRecovery = false;
    const response = await route.fetch();
    await route.fulfill({
      response,
      status: 503,
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await page.goto(gameUrl);
  await expect(page.locator("#challenge-result-title")).toBeVisible({ timeout: 15000 });
  expect(recoveries).toHaveLength(2);
  expect(recoveries[1]).toEqual(recoveries[0]);
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.locator("details")).toHaveCount(18);
  // Close only this isolated fixture publication to exercise the historical projection.
  await dockerSql(`update public.scheduled_challenges set status = 'closed'
    where id = '${data.data.timeoutPublicationId}'::uuid;`);
  await page.goto(
    `/salas/${data.data.timeoutRoom.slug}/historial/${data.data.timeoutPublicationId}/${data.users.bob.playerId}`,
  );
  await expect(page.getByText("0 de 18 letras acertadas", { exact: true })).toBeVisible();
  await expect(page.locator("details")).toHaveCount(18);
  await page.reload();
  await expect(page.getByText("0 de 18 letras acertadas", { exact: true })).toBeVisible();
  await expect(page.getByText("Sin responder", { exact: true })).toHaveCount(18);
});
