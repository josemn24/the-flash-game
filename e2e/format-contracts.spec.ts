import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("Flash evalúa short-text y recupera una respuesta aceptada cuya respuesta HTTP se perdió", async ({
  page,
}) => {
  const fixture = JSON.parse(await readFile("output/fixtures/format-contracts.json", "utf8"));
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users.alice.email);
  await page.getByLabel("Contraseña").fill(fixture.users.alice.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.getByRole("link", { name: /Abrir sala Sala format-contracts/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  const requests: unknown[] = [];
  let lost = true;
  await page.route("**/api/competitive/attempts/*/answer", async (route) => {
    requests.push(route.request().postDataJSON());
    if (!lost) return route.continue();
    lost = false;
    await route.fetch();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "command_failed" } }),
    });
  });
  await page.getByLabel("Escribe tu respuesta").fill("lisboa");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: "Capital de Portugal 2" })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  await page.getByLabel("Escribe tu respuesta").fill("Lisboa");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByText("Desafío completado")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Desafío completado")).toBeVisible();
});
