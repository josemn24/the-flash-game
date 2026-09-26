import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = { users: { alice: FixtureAccount; charlie: FixtureAccount; bob: FixtureAccount } };

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/f18.json", "utf8")) as Fixture;
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
  await page.getByRole("link", { name: /Abrir sala Sala competitiva F18/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash F18 Escape" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

async function solveEscape(page: Page) {
  const board = page.getByRole("group", { name: "Tablero Escape F18" });
  const move = async (button: Locator, axis: "x" | "y", distance: number, count: number) => {
    const [buttonBox, boardBox] = await Promise.all([button.boundingBox(), board.boundingBox()]);
    expect(buttonBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    const cellSize = (axis === "x" ? boardBox!.width : boardBox!.height) / 6;
    const startX = buttonBox!.x + buttonBox!.width / 2;
    const startY = buttonBox!.y + buttonBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + (axis === "x" ? distance * cellSize : 0), startY + (axis === "y" ? distance * cellSize : 0), {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page.getByText(new RegExp(`${count} movimiento`))).toBeVisible();
  };

  await move(page.getByRole("button", { name: /bloque C/ }), "x", -1, 1);
  await move(page.getByRole("button", { name: /bloque A/ }), "y", -1, 2);
  await move(page.getByRole("button", { name: /bloque B/ }), "y", 3, 3);
  await move(page.getByRole("button", { name: /pieza objetivo/ }), "x", 4, 4);
}

test.describe("F18 — escape competitivo", () => {
  test("oculta la solución, acepta la ruta final y reintenta idempotentemente", async ({ page }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.charlie);

    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: /Mueve los bloques/ })).toBeVisible();
    expect(await page.content()).not.toContain("referenceSolution");
    expect(await page.content()).not.toContain("optimalMoves");
    expect(await page.content()).not.toContain("solutionPayload");

    await page.reload();
    await expect(page.getByRole("heading", { name: /Mueve los bloques/ })).toBeVisible();

    const requestBodies: Array<Record<string, unknown>> = [];
    let firstResponse = true;
    await page.route("**/api/competitive/attempts/*/answer", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (!body.answer || typeof body.answer !== "object" || !("moves" in body.answer)) {
        await route.continue();
        return;
      }
      requestBodies.push(body);
      if (!firstResponse) {
        await route.continue();
        return;
      }
      firstResponse = false;
      const response = await route.fetch();
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: { code: "command_failed", requestId: "f18-lost-response" } }),
      });
      await response.body();
    });

    await solveEscape(page);
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").nth(1).locator("summary").click();
    await expect(page.getByText("Bloque liberado").first()).toBeVisible();
  });

  test("el timeout conserva los movimientos aplicados en los detalles", async ({ page }) => {
    test.setTimeout(75_000);
    const data = await fixture();
    await openFlash(page, data.users.alice);
    await page.getByRole("button", { name: "Lisboa" }).click();
    await expect(page.getByRole("heading", { name: /Mueve los bloques/ })).toBeVisible();
    await page.getByRole("button", { name: /bloque C/ }).press("ArrowLeft");
    await expect(page.getByText(/1 movimiento/)).toBeVisible();
    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").last().locator("summary").click();
    await expect(page.getByText(/Movimientos/)).toBeVisible();
  });

  test("el spectator no puede iniciar el Flash F18", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva F18/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash F18 Escape" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
