import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = { users: { superadmin: FixtureAccount; member: FixtureAccount } };

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s12.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

function madridLocal(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

test.describe("S12 — programar y ejecutar calendario", () => {
  test("un superadmin cancela una publicación futura y deja de estar disponible para jugar", async ({
    page,
    browser,
  }) => {
    const data = await fixture();
    await signIn(page, data.users.superadmin);
    await page.goto("/admin/rooms");
    await page.getByRole("link", { name: "Ver detalle de Sala S12" }).click();
    await page.getByRole("link", { name: "Calendario", exact: true }).click();
    await page.getByRole("button", { name: "Programar nuevo desafío" }).click();

    const now = Date.now();
    await page.getByLabel("Apertura").fill(madridLocal(new Date(now + 86_400_000)));
    await page.getByLabel("Cierre").fill(madridLocal(new Date(now + 90_000_000)));
    await page.getByLabel("Motivo de auditoría").fill("Programación que se retira en S12");
    await page.getByRole("button", { name: "Programar desafío" }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?tab=calendar&calendar=created$/);

    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Cancelar programación" })).toBeVisible();
    await page
      .getByLabel("Motivo de cancelación")
      .fill("La publicación se retira por revisión editorial");
    await page.getByRole("button", { name: "Confirmar cancelación" }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?tab=calendar&calendar=cancelled$/);
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar fechas", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);

    const memberContext = await browser.newContext();
    const member = await memberContext.newPage();
    await signIn(member, data.users.member);
    await member.goto("/salas/s12-room");
    await expect(member.getByText("Sin reto hoy", { exact: true })).toBeVisible();
    await expect(member.getByRole("link", { name: "Jugar" })).toHaveCount(0);
    await memberContext.close();
  });

  test("un superadmin programa y un miembro puede iniciar una publicación abierta", async ({
    page,
    browser,
  }) => {
    const data = await fixture();
    await signIn(page, data.users.superadmin);
    await page.goto("/admin/rooms");
    await page.getByRole("link", { name: "Ver detalle de Sala S12" }).click();
    await page.getByRole("link", { name: "Calendario", exact: true }).click();
    await page.getByRole("button", { name: "Programar nuevo desafío" }).click();
    const now = Date.now();
    await page.getByLabel("Apertura").fill(madridLocal(new Date(now - 60_000)));
    await page.getByLabel("Cierre").fill(madridLocal(new Date(now + 3_600_000)));
    await page.getByLabel("Motivo de auditoría").fill("Programar calendario S12");
    await page.getByRole("button", { name: "Programar desafío" }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/?]+\?tab=calendar&calendar=created$/);
    await page.reload();
    await expect(page.getByText("Abierto", { exact: true })).toBeVisible();

    const tick = await page.request.post("/api/internal/calendar/tick", {
      headers: {
        authorization: `Bearer ${process.env.CALENDAR_TICK_SECRET ?? "local-s12-calendar-secret"}`,
      },
    });
    expect(tick.ok()).toBeTruthy();

    const memberContext = await browser.newContext();
    const member = await memberContext.newPage();
    await signIn(member, data.users.member);
    await member.goto("/salas/s12-room");
    await expect(member.getByRole("heading", { name: "Flash S12 calendario" })).toBeVisible();
    await expect(member.getByText("Pendiente", { exact: true })).toBeVisible();
    await member.getByRole("link", { name: "Jugar" }).click();
    await expect(member).toHaveURL(/\/desafios\//);
    await expect(member.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
    await member.getByRole("button", { name: "Empezar desafío" }).click();
    await memberContext.close();
  });

  test("prepara y desplaza desafíos consecutivos en una temporada en borrador", async ({
    page,
  }) => {
    const data = await fixture();
    await signIn(page, data.users.superadmin);
    await page.goto("/admin/rooms");
    await page.getByRole("link", { name: "Ver detalle de Sala S12" }).click();
    await page.getByRole("link", { name: "Temporadas", exact: true }).click();
    const create = page.locator("form").filter({ hasText: "Preparar temporada" });
    await create.getByLabel("Título").fill("Calendario S12 borrador");
    await create.getByLabel(/Inicio/).fill("2030-09-20T12:00");
    await create.getByLabel(/Fin/).fill("2030-09-21T12:00");
    await create.getByLabel("Motivo de auditoría").fill("Preparar calendario sin publicar");
    await create.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page).toHaveURL(/season=created/);
    await page.getByRole("link", { name: "Calendario", exact: true }).click();
    for (const [opening, closing] of [
      ["12:00", "12:05"],
      ["12:05", "12:10"],
    ]) {
      await page.getByRole("button", { name: "Programar nuevo desafío" }).click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Temporada", { exact: true })
        .selectOption({ label: "Sala S12 · Calendario S12 borrador" });
      await dialog.getByLabel("Apertura").fill(`2030-09-20T${opening}`);
      await dialog.getByLabel("Cierre").fill(`2030-09-20T${closing}`);
      await dialog.getByLabel("Motivo de auditoría").fill("Preparar publicación consecutiva");
      await dialog.getByRole("button", { name: "Programar desafío" }).click();
      await expect(page).toHaveURL(/calendar=created/);
    }
    await page.getByRole("button", { name: "Editar fechas", exact: true }).first().click();
    const editor = page.getByRole("dialog");
    await editor.getByLabel("Aplicar a").selectOption("following");
    await editor.getByLabel("Apertura").fill("2030-09-20T12:05");
    await editor.getByLabel("Motivo del cambio").fill("Desplazar ambas ventanas cinco minutos");
    await editor.getByRole("button", { name: "Revisar cambios" }).click();
    await expect(editor.getByText("Desafío #2", { exact: true })).toBeVisible();
    await expect(editor.getByLabel("Motivo del cambio")).toHaveValue(
      "Desplazar ambas ventanas cinco minutos",
    );
    await editor.getByRole("button", { name: "Guardar calendario" }).click();
    await expect(editor).not.toBeVisible();
    await page.getByRole("button", { name: "Editar fechas", exact: true }).first().click();
    await expect(editor.getByLabel("Apertura")).toHaveValue("2030-09-20T12:05");
    await expect(editor.getByLabel("Cierre")).toHaveValue("2030-09-20T12:10");
  });

  test("un miembro no ve controles administrativos ni borradores", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.member);
    await page.goto("/admin");
    await expect(page.getByText("Acceso no disponible")).toBeVisible();
    await expect(page.getByText("Programar desafíos")).toHaveCount(0);
  });
});
