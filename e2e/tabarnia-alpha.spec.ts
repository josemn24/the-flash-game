import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type Account = { email: string; password: string };
type Fixture = {
  users: { ches: Account; xesmona: Account };
  data: {
    room: { slug: string };
    publicationId: string;
    avatars: Array<{ label: string; objectPath: string }>;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/tabarnia.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: Account) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

test.describe("Tabarnia alpha", () => {
  test("Ches puede abrir la sala y comenzar Steel Ball Run", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.ches);
    await page.getByRole("link", { name: /Abrir sala Tabarnia/ }).click();

    await page.getByRole("link", { name: /Ver ranking de la sala/ }).click();
    for (const label of ["Dark", "Jacobo"]) {
      const avatar = data.data.avatars.find((item) => item.label === label.toLowerCase());
      expect(avatar).toBeDefined();
      await expect(page.getByRole("img", { name: label }).first().locator("img")).toHaveAttribute(
        "src",
        expect.stringContaining(encodeURIComponent(avatar!.objectPath)),
      );
      await expect(page.getByRole("img", { name: label }).first().locator("img")).toHaveJSProperty(
        "naturalWidth",
        640,
      );
    }
    await expect(page.getByRole("img", { name: "Ches" }).first().getByText("CH")).toBeVisible();
    await page.getByRole("link", { name: "Volver al detalle de la sala" }).click();

    await page.getByRole("link", { name: "Jugar" }).click();
    await expect(page.getByRole("heading", { name: "Steel Ball Run" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Empezar desafío" }).click();
    await expect(page.getByRole("heading", { name: /Caballo de Fuego/ })).toBeVisible();
  });

  test("xesmona queda fuera de la sala competitiva", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.xesmona);
    await expect(page.getByRole("link", { name: /Abrir sala Tabarnia/ })).toHaveCount(0);
  });
});
