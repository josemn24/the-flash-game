import { expect, test, type Page } from "@playwright/test";
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
  return dialog;
}

test.describe("Perfil responsive en mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("ancla la modal arriba y mantiene visible el campo de nombre", async ({ page }) => {
    await signIn(page);
    const dialog = await openProfile(page);
    const dialogBox = await dialog.boundingBox();
    const nameBox = await dialog.getByLabel("Nombre visible").boundingBox();

    expect(dialogBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    expect(dialogBox!.y).toBeLessThan(80);
    expect(nameBox!.y).toBeGreaterThanOrEqual(0);
    expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(844);
    await expect(dialog).toHaveAttribute("open", "");
    expect(
      await dialog.evaluate((element) =>
        element.style.getPropertyValue("--profile-dialog-viewport-height"),
      ),
    ).toMatch(/px$/);
  });
});

test.describe("Perfil responsive en desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("mantiene la modal centrada", async ({ page }) => {
    await signIn(page);
    const dialog = await openProfile(page);
    const dialogBox = await dialog.boundingBox();

    expect(dialogBox).not.toBeNull();
    const dialogCenter = dialogBox!.y + dialogBox!.height / 2;
    expect(Math.abs(dialogCenter - 450)).toBeLessThan(24);
  });
});
