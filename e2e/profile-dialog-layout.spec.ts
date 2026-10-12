import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type Account = { email: string; password: string };

async function signIn(page: Page) {
  const fixture = JSON.parse(await readFile("output/fixtures/portal.json", "utf8")) as {
    users: { superadmin: Account };
  };

  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users.superadmin.email);
  await page.getByLabel("Contraseña").fill(fixture.users.superadmin.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tu perfil" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cerrar perfil" })).toBeFocused();
  return dialog;
}

// Keep the layout viewport unchanged: a real iPhone keyboard only reduces the
// visual viewport. Resizing the page itself would miss the original regression.
async function installVisualViewport(page: Page, height: number) {
  await page.evaluate((height) => {
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { configurable: true, value: height },
      offsetTop: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  }, height);
}

async function resizeVisualViewport(page: Page, height: number, top = 0) {
  await page.evaluate(
    ({ height, top }) => {
      const viewport = window.visualViewport!;
      Object.defineProperties(viewport, {
        height: { configurable: true, value: height },
        offsetTop: { configurable: true, value: top },
      });
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    },
    { height, top },
  );
}

async function expectVisibleEditor(dialog: Locator, width: number, height: number, top = 0) {
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box && [box.x, box.y, box.width, box.height].map(Math.round);
    })
    .toEqual([0, top, width, height]);
  const box = await dialog.boundingBox();
  const header = await dialog.locator("header").boundingBox();
  const name = await dialog.getByLabel("Nombre visible").boundingBox();
  const save = await dialog.getByRole("button", { name: "Guardar cambios" }).boundingBox();
  expect(box).not.toBeNull();
  expect(header).not.toBeNull();
  expect(name).not.toBeNull();
  expect(save).not.toBeNull();
  expect(box!.x).toBeCloseTo(0);
  expect(box!.y).toBeCloseTo(top);
  expect(box!.width).toBeCloseTo(width);
  expect(box!.height).toBeCloseTo(height);
  expect(save!.y).toBeGreaterThanOrEqual(top);
  expect(save!.y + save!.height).toBeLessThanOrEqual(top + height);
  expect(name!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  expect(name!.y + name!.height).toBeLessThanOrEqual(top + height);
  const form = dialog.locator("form");
  expect(await form.evaluate((element) => element.scrollTop)).toBe(0);
  const formBox = await form.boundingBox();
  expect(name!.y + name!.height).toBeLessThanOrEqual(formBox!.y + formBox!.height);
  expect(await dialog.evaluate((element) => getComputedStyle(element).borderRadius)).toBe("0px");
}

test.describe("Perfil responsive", () => {
  test.use({ reducedMotion: "reduce" });

  for (const width of [320, 390]) {
    test.describe(`Móvil de ${width}px`, () => {
      test.use({ viewport: { width, height: 844 }, hasTouch: true });

      test("ocupa la pantalla y mantiene nombre y guardar visibles con el teclado", async ({
        page,
      }, testInfo) => {
        await signIn(page);
        await installVisualViewport(page, 844);
        const dialog = await openProfile(page);
        await expectVisibleEditor(dialog, width, 844);
        await expect(dialog.getByRole("button", { name: "Cambiar foto" })).toBeVisible();
        await expect(dialog.getByLabel("Imagen de perfil")).toBeHidden();
        expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");

        await dialog.getByLabel("Nombre visible").focus();
        await resizeVisualViewport(page, 350, 48);
        await expectVisibleEditor(dialog, width, 350, 48);
        expect(await page.evaluate(() => window.innerHeight)).toBe(844);
        if (testInfo.project.name === "chromium" && width === 390) {
          await page.screenshot({ path: "output/playwright/profile-mobile-keyboard.png" });
        }

        await resizeVisualViewport(page, 844);
        await expectVisibleEditor(dialog, width, 844);
        await dialog.getByRole("button", { name: "Cerrar perfil" }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Perfil", exact: true })).toBeFocused();
        await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("");
      });
    });
  }

  test.describe("Móvil horizontal", () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
    test("conserva la pantalla completa al rotar", async ({ page }) => {
      await signIn(page);
      const dialog = await openProfile(page);
      await expectVisibleEditor(dialog, 844, 390);
      await page.setViewportSize({ width: 390, height: 844 });
      await expectVisibleEditor(dialog, 390, 844);
    });
  });

  test.describe("Escritorio", () => {
    test.use({ viewport: { width: 1280, height: 900 }, hasTouch: false });
    test("mantiene la modal centrada y el guardado funciona desde cabecera y Enter", async ({
      page,
    }) => {
      await signIn(page);
      const dialog = await openProfile(page);
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBe(520);
      expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThan(1);
      expect(Math.abs(box!.y + box!.height / 2 - 450)).toBeLessThan(1);
      await expect(dialog.getByRole("button", { name: "Cancelar" })).toHaveCount(0);
      const name = dialog.getByLabel("Nombre visible");
      const originalName = await name.inputValue();
      await name.fill(` ${originalName} `);
      await name.press("Enter");
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Perfil", exact: true })).toBeFocused();
      await openProfile(page);
      await expect(name).toHaveValue(originalName);
      await dialog.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByText("Cambios guardados.", { exact: true })).toHaveCount(1);
    });
  });
});
