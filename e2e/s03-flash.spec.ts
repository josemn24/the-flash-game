import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type Fixture = {
  users: {
    alice: { email: string; password: string };
    bob: { email: string; password: string };
    carol: { email: string; password: string };
    dave: { email: string; password: string };
  };
  data: {
    room: { slug: string };
    publicationId: string;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s03.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openFlash(page: Page, account: { email: string; password: string }) {
  await signIn(page, account);
  await page.getByRole("link", { name: /Abrir sala Sala competitiva S03/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Flash competitivo" })).toBeVisible();
  await expect(page).toHaveURL(/\/desafios\/[^/]+\?roomId=/);
  await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(1);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

test.describe("S03 — Flash competitivo persistido", () => {
  test("completa dos preguntas, persiste el resultado y lo conserva tras recargar", async ({
    page,
  }) => {
    const data = await fixture();
    await openFlash(page, data.users.alice);
    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    expect(await page.content()).not.toContain("Lisboa es la capital de Portugal");

    await page.getByRole("button", { name: "Lisboa" }).dblclick();
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
    await page.getByRole("button", { name: "Marte" }).dblclick();

    await expect(page.getByText("Desafío completado")).toBeVisible();
    await expect(page.getByText(/\/100 puntos/)).toBeVisible();
    expect(await page.content()).not.toContain("S03_PRIVATE");

    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await expect(page.getByText("Lisboa es la capital de Portugal")).toBeVisible();
  });

  test("persiste un resultado válido con score cero", async ({ page }) => {
    await page.route("**/api/competitive/attempts/*/answer", async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ response });
    });

    await openFlash(page, (await fixture()).users.carol);
    await page.getByRole("button", { name: "Empezar desafío" }).click();
    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await page.getByRole("button", { name: "Oporto" }).click();
    await expect(page.getByText("Comprobando respuesta…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Oporto" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
    await page.getByRole("button", { name: "Venus" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await expect(page.getByText(/0\/100 puntos/)).toBeVisible();
  });

  test("convierte el timeout de una pregunta en una respuesta persistida", async ({ page }) => {
    await openFlash(page, (await fixture()).users.dave);
    await page.getByRole("button", { name: "Empezar desafío" }).click();
    await expect(page.getByRole("heading", { name: /capital de Portugal/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tiempo agotado" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /planeta rojo/ })).toBeVisible();
    await page.getByRole("button", { name: "Venus" }).click();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await expect(page.getByText(/0\/100 puntos/)).toBeVisible();
  });

  test("el spectator puede consultar la sala pero no iniciar el competitivo", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.bob);
    await page.getByRole("link", { name: /Abrir sala Sala competitiva S03/ }).click();
    await expect(page.getByRole("link", { name: "Ver introducción" })).toBeVisible();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Flash competitivo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
  });
});
