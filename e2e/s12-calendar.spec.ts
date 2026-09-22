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
    await expect(page.getByText("Programado")).toBeVisible();

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

  test("un miembro no ve controles administrativos ni borradores", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.member);
    await page.goto("/admin");
    await expect(page.getByText("Acceso no disponible")).toBeVisible();
    await expect(page.getByText("Programar desafíos")).toHaveCount(0);
  });
});
