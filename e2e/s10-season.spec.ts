import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = { users: Record<string, FixtureAccount> };

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s10.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

test.describe("S10 — preparar y activar una temporada", () => {
  test("el superadmin crea, edita y activa una temporada desde el portal", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.superadmin);
    await page.goto("/admin/rooms");
    await page.getByRole("link", { name: "Ver detalle de Sala S10" }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+$/);

    const roomSection = page.getByRole("region", { name: "Sala S10" }).last();
    const createForm = roomSection
      .locator("form")
      .filter({ hasText: "Preparar temporada" })
      .first();
    await createForm.getByLabel("Título").fill("Temporada S10");
    await createForm.getByLabel(/Inicio/).fill("2030-09-20T12:30");
    await createForm.getByLabel(/Fin/).fill("2030-09-27T12:30");
    await createForm.getByLabel("Motivo de auditoría").fill("Preparar temporada S10");
    await createForm.getByRole("button", { name: "Guardar borrador" }).click();

    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?tab=seasons&season=created$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Borrador de temporada creado" }),
    ).toBeVisible();
    await page.reload();

    const seasonCard = roomSection.getByRole("article").filter({ hasText: "Temporada S10" });
    const editForm = seasonCard.locator("form").first();
    await editForm.getByLabel("Título").fill("Temporada S10 editada");
    await editForm.getByLabel(/Inicio/).fill("2030-09-20T12:30");
    await editForm.getByLabel(/Fin/).fill("2030-09-27T12:30");
    await editForm.getByLabel("Motivo de auditoría").fill("Ajustar temporada S10");
    await editForm.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?tab=seasons&season=updated$/);

    await page.reload();
    const editedCard = roomSection
      .getByRole("article")
      .filter({ hasText: "Temporada S10 editada" });
    const activateForm = editedCard.locator("form").last();
    await activateForm.getByLabel("Motivo de activación").fill("Abrir temporada S10");
    page.once("dialog", (dialog) => dialog.accept());
    await activateForm.getByRole("button", { name: "Activar temporada" }).click();

    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?tab=seasons&season=activated$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Temporada activada correctamente" }),
    ).toBeVisible();
    await expect(page.getByText("Activa").last()).toBeVisible();
    expect(await roomSection.count()).toBe(1);
  });

  test("las rutas globales de temporadas y calendario ya no están disponibles", async ({
    page,
  }) => {
    const data = await fixture();
    await signIn(page, data.users.superadmin);
    expect((await page.goto("/admin/seasons"))?.status()).toBe(404);
    expect((await page.goto("/admin/calendar"))?.status()).toBe(404);
  });

  test("un miembro no puede acceder al portal privado", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.member);
    await page.goto("/admin");
    await expect(page.getByText("Acceso no disponible")).toBeVisible();
  });
});
