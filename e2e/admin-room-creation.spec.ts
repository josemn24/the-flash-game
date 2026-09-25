import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: Record<string, FixtureAccount>;
  data: {
    title: string;
    ownerEmail: string;
    memberEmails: { email: string; role: "admin" | "member" | "spectator" }[];
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s08.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

test.describe("S08 — crear una sala privada", () => {
  test("el superadmin crea una sala y su grupo inicial desde el portal", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.superadmin);
    await page.goto("/admin/rooms");

    const ownerGroup = page.getByRole("group", { name: "Propietario inicial" });
    await ownerGroup.getByRole("textbox").fill(data.data.ownerEmail);
    await ownerGroup.getByRole("button", { name: "Buscar" }).click();
    await expect(ownerGroup.getByText("Owner S08")).toBeVisible();

    for (const member of data.data.memberEmails) {
      await page.getByRole("button", { name: "Añadir miembro" }).click();
      const row = page.locator('[aria-label="Email del miembro"]').last().locator("..");
      await row.getByLabel("Email del miembro").fill(member.email);
      await row.getByLabel("Rol del miembro").selectOption(member.role);
      await row.getByRole("button", { name: "Buscar" }).click();
      await expect(row).toContainText(
        member.role === "admin"
          ? "Admin S08"
          : member.role === "member"
            ? "Member S08"
            : "Spectator S08",
      );
    }

    await page.getByLabel("Título").fill(data.data.title);
    await page.getByLabel("Descripción").fill("Sala creada desde E2E");
    await page.getByLabel("Motivo de auditoría").fill("Preparación de la beta E2E");
    await expect(page.getByRole("button", { name: "Crear sala" })).toBeEnabled();
    await page.getByRole("button", { name: "Crear sala" }).click();

    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?created=1$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Sala creada correctamente" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: data.data.title }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Temporadas" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: data.data.title }).first()).toBeVisible();
  });

  test("un usuario normal y una sesión anónima no acceden al portal", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.owner);
    await page.goto("/admin/rooms");
    await expect(page.getByText("Acceso no disponible")).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
  });
});
