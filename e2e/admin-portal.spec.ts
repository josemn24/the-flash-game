import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

type FixtureAccount = { email: string; password: string };

type Fixture = {
  users: {
    superadmin: FixtureAccount;
    member: FixtureAccount;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/portal.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

test.describe("Portal privado mínimo", () => {
  test("superadmin ve su contexto y las salas activas después de recargar", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.superadmin);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Todo listo para operar." })).toBeVisible();
    await expect(page.getByText("Operador beta")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sala Alpha" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sala Beta" }).first()).toBeVisible();
    await expect(page.getByText("Sala archivada")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Sala Alpha" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sala Beta" }).first()).toBeVisible();
  });

  test("un miembro no puede enumerar el portal y el anónimo vuelve al inicio", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.member);

    await page.goto("/admin");
    await expect(page.getByText("Acceso no disponible")).toBeVisible();
    expect(page.url()).toContain("/admin");

    await page.goto("/");
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("sube el avatar con la URL firmada y conserva la imagen después de recargar", async ({
    page,
  }) => {
    const data = await fixture();
    await signIn(page, data.users.member);
    const image = await sharp({
      create: { width: 32, height: 32, channels: 4, background: "#ff7276" },
    })
      .png()
      .toBuffer();

    await page.getByRole("button", { name: "Perfil", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Tu perfil" });
    await dialog.getByLabel("Imagen de perfil").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: image,
    });
    const upload = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname.includes("/object/upload/sign/"),
    );
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    expect((await upload).ok()).toBe(true);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("Cambios guardados.", { exact: true })).toHaveCount(1);
    await page.reload();
    const avatar = page.getByRole("button", { name: "Perfil", exact: true }).locator("img");
    await expect(avatar).toBeVisible();
    expect(await avatar.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(32);
  });
});
