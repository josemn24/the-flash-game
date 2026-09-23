import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type Account = { email: string; password: string };
type Fixture = {
  users: { ches: Account; dark: Account; xesmona: Account };
  data: {
    room: { slug: string };
    publicationId: string;
    publications: Array<{ id: string; title: string; mode: string; status: string }>;
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
  test("Ches puede abrir los ajustes de la sala persistida", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.ches);
    await page.getByRole("link", { name: /Abrir sala Tabarnia/ }).click();

    const response = await page.goto(`/salas/${data.data.room.slug}/ajustes`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Tabarnia", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Miembros", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: /Flash Points/ }).first()).toBeVisible();
  });

  test("mantiene 404 para una sala inexistente o no autorizada", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.xesmona);

    const missingResponse = await page.goto("/salas/sala-inexistente/ajustes");
    expect(missingResponse?.status()).toBe(404);

    const unauthorizedResponse = await page.goto(`/salas/${data.data.room.slug}/ajustes`);
    expect(unauthorizedResponse?.status()).toBe(404);
  });

  test("Ches puede promover y degradar miembros desde ajustes", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.ches);
    await page.goto(`/salas/${data.data.room.slug}/ajustes`);

    const actions = page.getByRole("button", { name: "Acciones para Dark" });
    await expect(actions).toBeVisible();
    await actions.click();
    await page.getByRole("button", { name: "Dar permisos de administrador" }).click();
    await expect(page.getByText("Admin", { exact: true })).toBeVisible();

    await actions.click();
    await page.getByRole("button", { name: "Quitar permisos de administrador" }).click();
    await expect(page.getByText("Admin", { exact: true })).toHaveCount(0);
  });

  test("un miembro normal no ve acciones administrativas", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.dark);
    await page.goto(`/salas/${data.data.room.slug}/ajustes`);

    await expect(page.getByRole("heading", { name: "Miembros", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Acciones para/ })).toHaveCount(0);
  });

  test("Ches puede expulsar lógicamente a un miembro", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.ches);
    await page.goto(`/salas/${data.data.room.slug}/ajustes`);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Acciones para Carlos" }).click();
    await page.getByRole("button", { name: "Expulsar de la sala" }).click();
    await expect(page.getByText("Carlos", { exact: true })).toHaveCount(0);
  });

  test("Ches ve La Pirámide como primera publicación del orden Tabarnia", async ({ page }) => {
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
    await expect(
      page.getByRole("heading", { name: "La Pirámide: Biblia y religiones abrahámicas" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
    expect(data.data.publicationId).toBe(data.data.publications[0]?.id);
    expect(data.data.publications[0]).toMatchObject({
      title: "La Pirámide: Biblia y religiones abrahámicas",
      mode: "pyramid",
      status: "open",
    });
    expect(data.data.publications[1]).toMatchObject({
      title: "Steel Ball Run",
      mode: "flash",
      status: "scheduled",
    });
    expect(data.data.publications.at(-1)).toMatchObject({
      title: "Supervivencia: España",
      mode: "survival",
      status: "scheduled",
    });
  });

  test("xesmona queda fuera de la sala competitiva", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.xesmona);
    await expect(page.getByRole("link", { name: /Abrir sala Tabarnia/ })).toHaveCount(0);
  });
});
