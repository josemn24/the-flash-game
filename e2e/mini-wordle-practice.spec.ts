import { expect, test, type Page } from "@playwright/test";
import { expectPinnedWordleKeyboard } from "./support/keyboard-layout";

async function openExample(page: Page) {
  await page.goto("/formatos/mini-wordle");
  await page.getByRole("button", { name: "Probar este formato" }).click();
  await page.getByRole("button", { name: "Empezar ejemplo" }).click();
  return page.getByRole("dialog");
}

test("Mini-Wordle recupera el diccionario y permite teclado propio, físico y nativo", async ({
  page,
}) => {
  let dictionaryRequests = 0;
  await page.route("**/dictionaries/es-general-4.v1.json", async (route) => {
    dictionaryRequests++;
    if (dictionaryRequests === 1) await route.fulfill({ status: 503, body: "offline" });
    else await route.continue();
  });
  const dialog = await openExample(page);
  const editor = dialog.getByRole("textbox", { name: "Escribe tu intento" });
  await expect(dialog.getByText("No se pudo cargar el diccionario.")).toBeVisible();
  await expect(editor).toHaveAttribute("aria-disabled", "true");
  await expect(dialog.getByRole("timer")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(editor).toHaveAttribute("aria-disabled", "false");
  await expect(editor).toBeFocused();
  await expect(dialog.getByRole("timer")).toBeVisible();
  await editor.pressSequentially("ZZZZ");
  await editor.press("Enter");
  await expect(
    dialog.getByText("Esa palabra no está en la lista de intentos válidos."),
  ).toBeVisible();
  await expect(editor).toHaveAccessibleDescription(/Intento 1 de 4/);
  await expect(dialog.getByLabel("Intento 1, en curso")).toHaveText("ZZZZ");
  for (let i = 0; i < 4; i++) await editor.press("Backspace");
  const keyboard = dialog.getByRole("group", { name: "Teclado del juego" });
  for (const letter of "CASA")
    await keyboard.getByRole("button", { name: letter, exact: true }).click();
  await expect(dialog.getByLabel("Intento 1, en curso")).toHaveText("CASA");
  await expect(editor).toBeFocused();
  await editor.press("Tab");
  await expect(dialog.getByRole("button", { name: "Usar teclado del dispositivo" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Enviar", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog.getByLabel("Intento 1: CASA", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Intento 2, en curso")).toHaveText("");
  await expect(editor).toBeFocused();
  await editor.pressSequentially("lu");
  await dialog.getByRole("button", { name: "Usar teclado del dispositivo" }).click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("LU");
  await expect(keyboard).toHaveCount(0);
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
      const bounds = await dialog.locator("[data-keyboard-dock]").boundingBox();
      return bounds!.y + bounds!.height;
    })
    .toBeLessThanOrEqual(328);
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("LU");
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const area = element.closest("[data-keyboard-scroll]")!.getBoundingClientRect();
        const row = element.getBoundingClientRect();
        return Math.max(area.top - row.top, row.bottom - area.bottom);
      }),
    )
    .toBeLessThanOrEqual(1);
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Reflect.deleteProperty(viewport, "height");
    Reflect.deleteProperty(viewport, "offsetTop");
    viewport.dispatchEvent(new Event("resize"));
  });
  await editor.fill("luna");
  await expect(dialog.getByLabel("Intento 2, en curso")).toHaveText("LUNA");
  await editor.press("Enter");
  await expect(dialog.getByRole("heading", { name: "Resultado del ejemplo" })).toBeVisible();
  await expect(dialog.getByText("Respuesta correcta", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(editor).toHaveAttribute("aria-disabled", "false");
  await expect(dialog.getByLabel("Intento 1, en curso")).toHaveText("");
  await expect(dialog.getByRole("button", { name: "Usar teclado del dispositivo" })).toBeVisible();
  await expect(editor).toHaveAccessibleDescription(/Intento 1 de 4/);
  await dialog.getByRole("button", { name: "Usar teclado del dispositivo" }).click();
  await editor.fill("lu");
  await page.reload();
  await page.getByRole("button", { name: "Probar este formato" }).click();
  await page.getByRole("button", { name: "Empezar ejemplo" }).click();
  await expect(dialog.getByLabel("Intento 1, en curso")).toHaveText("");
  await expect(dialog.getByRole("button", { name: "Usar teclado del dispositivo" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Teclado del juego" })).toBeVisible();
  expect(dictionaryRequests).toBe(3);
});

for (const { width, height } of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 700 },
  { width: 844, height: 390 },
]) {
  test(`Mini-Wordle fija el teclado y permite scroll en ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const dialog = await openExample(page);
    const editor = dialog.getByRole("textbox", { name: "Escribe tu intento" });
    await expect(editor).toHaveAttribute("aria-disabled", "false");
    const keyboard = dialog.getByRole("group", { name: "Teclado del juego" });
    await expect(keyboard).toBeVisible();
    if (width <= 640)
      await expect(dialog.getByRole("button", { name: /Usar teclado/ })).toHaveCount(0);
    expect(await editor.evaluate((element) => element.tagName)).toBe("DIV");
    const bounds = await keyboard.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const actionGap = await keyboard.evaluate((group) => {
      const send = group.parentElement!.querySelector('button[type="submit"]')!;
      return group.getBoundingClientRect().top - send.getBoundingClientRect().bottom;
    });
    expect(actionGap).toBeGreaterThanOrEqual(0);
    expect(actionGap).toBeLessThanOrEqual(12);
    const keyBounds = await keyboard.getByRole("button", { name: "A", exact: true }).boundingBox();
    expect(keyBounds!.width).toBeGreaterThanOrEqual(24);
    expect(Math.round(keyBounds!.height)).toBeGreaterThanOrEqual(height <= 480 ? 32 : 44);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await expectPinnedWordleKeyboard(page);
    for (const letter of "CASA")
      await keyboard.getByRole("button", { name: letter, exact: true }).click();
    await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(dialog.getByLabel("Intento 1: CASA", { exact: true })).toBeVisible();
    if (width === 390) {
      await editor.pressSequentially("lu");
      await page.setViewportSize({ width: 1024, height: 768 });
      await dialog.getByRole("button", { name: "Usar teclado del dispositivo" }).click();
      await expect(dialog.getByRole("button", { name: "Usar teclado del juego" })).toBeVisible();
      await expect(editor).toHaveValue("LU");
      await page.setViewportSize({ width, height: 700 });
      await expect(keyboard).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Usar teclado/ })).toHaveCount(0);
      await expect(dialog.getByLabel("Intento 2, en curso")).toHaveText("LU");
    }
  });
}
