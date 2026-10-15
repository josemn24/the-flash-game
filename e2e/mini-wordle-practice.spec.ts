import { expect, test } from "@playwright/test";

test("Mini-Wordle de práctica recupera el diccionario y completa el ejemplo con teclado", async ({
  page,
}) => {
  let dictionaryRequests = 0;
  await page.route("**/dictionaries/es-general-4.v1.json", async (route) => {
    dictionaryRequests++;
    if (dictionaryRequests === 1) {
      await route.fulfill({ status: 503, body: "offline" });
    } else {
      await route.continue();
    }
  });
  await page.goto("/formatos/mini-wordle");
  await page.getByRole("button", { name: "Probar este formato" }).click();
  await page.getByRole("button", { name: "Empezar ejemplo" }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Escribe tu intento");
  await expect(dialog.getByText("No se pudo cargar el diccionario.")).toBeVisible();
  await expect(input).toBeDisabled();
  await expect(dialog.getByRole("timer")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(dialog.getByRole("timer")).toBeVisible();
  await input.fill("ZZZZ");
  await input.press("Enter");
  await expect(
    dialog.getByText("Esa palabra no está en la lista de intentos válidos."),
  ).toBeVisible();
  await expect(dialog.getByText("Intento 1 de 4")).toBeVisible();
  await expect(input).toHaveValue("ZZZZ");
  await input.fill("CASA");
  await input.press("Enter");
  await expect(dialog.getByLabel("Intento 1: CASA", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await input.fill("luna");
  await input.press("Enter");
  await expect(dialog.getByRole("heading", { name: "Resultado del ejemplo" })).toBeVisible();
  await expect(dialog.getByText("Respuesta correcta", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(input).toBeEnabled();
  await expect(dialog.getByText("Intento 1 de 4")).toBeVisible();
  expect(dictionaryRequests).toBe(2);
});
