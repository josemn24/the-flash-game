import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("Pirámide activa y evalúa los siete niveles short-text", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = JSON.parse(
    await readFile("output/fixtures/format-contracts-pyramid.json", "utf8"),
  );
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users.alice.email);
  await page.getByLabel("Contraseña").fill(fixture.users.alice.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.getByRole("link", { name: /Abrir sala Sala format-contracts-pyramid/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  for (let level = 1; level <= 7; level++) {
    await expect(page.getByRole("heading", { name: `Briefing ${level}` })).toBeVisible();
    await expect(page.getByLabel("Escribe tu respuesta")).toHaveCount(0);
    await page.getByRole("button", { name: "Empezar nivel" }).click();
    await expect(page.getByRole("heading", { name: `Capital de Portugal ${level}` })).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    await page.getByLabel("Escribe tu respuesta").fill("Lisboa");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
  }
  await expect(page.getByText("Desafío completado")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Desafío completado")).toBeVisible();
});
