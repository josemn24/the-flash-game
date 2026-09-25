import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: { owner: FixtureAccount; spectator: FixtureAccount };
  data: { room: { slug: string }; publicationId: string };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/sbr.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function openFlash(page: Page, account: FixtureAccount) {
  await signIn(page, account);
  await page.getByRole("link", { name: /Abrir sala Steel Ball Run/ }).click();
  await page.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { name: "Steel Ball Run" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Empezar desafío" }).click();
}

async function waitForQuestion(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 20_000 });
}

test.describe("SBR — fixture persistido con mapa privado", () => {
  test("completa los 16 formatos, recupera y revisa el heat-map", async ({ page }) => {
    test.setTimeout(180_000);
    const data = await fixture();
    await openFlash(page, data.users.owner);

    await waitForQuestion(page, /Caballo de Fuego/);
    await page.getByRole("button", { name: "La cultura china" }).click();

    await waitForQuestion(page, /familia de los équidos/);
    await page.getByRole("button", { name: "Bisonte" }).click();

    await waitForQuestion(page, "Relaciona cada país con su moneda.");
    for (const [left, right] of [
      ["Estados Unidos", "Dólar"],
      ["Japón", "Yen"],
      ["México", "Peso"],
      ["España", "Euro"],
    ]) {
      await page.getByRole("button", { name: left, exact: true }).click();
      await page.getByRole("button", { name: right, exact: true }).click();
    }

    await waitForQuestion(page, "Ordena estas ciudades de oeste a este.");
    await page.getByRole("button", { name: "Mover San Diego arriba" }).click();
    await page.getByRole("button", { name: "Mover San Diego arriba" }).click();
    await page.getByRole("button", { name: "Mover Denver arriba" }).click();
    await page.getByRole("button", { name: "Mover Chicago arriba" }).click();
    await page.getByRole("button", { name: "Confirmar orden" }).click();

    await waitForQuestion(page, "¿Qué paisaje aparece en la imagen?");
    await expect(page.getByRole("progressbar", { name: "Progreso de revelado" })).toBeVisible();
    await page.getByLabel("¿Qué aparece en la imagen?").fill("Gran Cañón");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();

    await waitForQuestion(page, /dónde se encuentra el Gran Cañón/);
    const map = page.getByRole("button", { name: /Mapa sin etiquetas.*Pulsa sobre la imagen/ });
    await expect(map).toBeVisible();
    await expect(map.locator("img")).toHaveAttribute("src", /question-assets/);
    expect(await page.content()).not.toContain("fullCreditRadius");
    expect(await page.content()).not.toContain("toleranceRadius");
    const mapBox = await map.boundingBox();
    expect(mapBox).not.toBeNull();
    await map.click({
      position: { x: (mapBox?.width ?? 1) * 0.226, y: (mapBox?.height ?? 1) * 0.537 },
    });
    await map.focus();
    await map.press("Enter");
    await map.press("ArrowRight");
    await page.getByRole("button", { name: "Confirmar ubicación" }).click();

    await waitForQuestion(page, /velocidad media/);
    await page.getByRole("slider", { name: "Estimación en km/h" }).fill("36");
    await page.getByRole("button", { name: "Confirmar estimación" }).click();

    await waitForQuestion(page, /Clasifica cada objeto/);
    const classifications = [
      ["Brújula", "Útil en 1890"],
      ["Telégrafo", "Útil en 1890"],
      ["Cantimplora", "Útil en 1890"],
      ["Navegador GPS", "Anacrónico"],
      ["Smartphone", "Anacrónico"],
    ];
    for (const [item, category] of classifications) {
      await page.getByRole("button", { name: `Clasificar ${item} como ${category}` }).click();
    }
    await page.getByRole("button", { name: "Confirmar clasificación" }).click();

    await waitForQuestion(page, "Forma una palabra relacionada con el desafío.");
    for (const letter of ["C", "A", "R", "R", "E", "R", "A"]) {
      await page
        .getByRole("button", { name: `Añadir letra ${letter}` })
        .first()
        .click();
    }
    await page.getByRole("button", { name: "Enviar palabra" }).click();

    await waitForQuestion(page, /Qué transportaba principalmente/);
    await page.getByRole("button", { name: "Correo" }).click();
    await waitForQuestion(page, "Los caballos pueden dormir de pie.");
    await page.getByRole("button", { name: "Verdadero" }).click();
    await waitForQuestion(page, /Qué dos elementos forman/);
    await page.getByRole("button", { name: "Hierro y carbono" }).click();

    await waitForQuestion(page, /movimientos del caballo/);
    await page.getByRole("button", { name: "Mover Paso arriba" }).click();
    await page.getByRole("button", { name: "Mover Trote arriba" }).click();
    await page.getByRole("button", { name: "Confirmar orden" }).click();

    await waitForQuestion(page, /Según Bernoulli/);
    await page.getByRole("button", { name: "El aire más rápido ejerce menos presión" }).click();
    await waitForQuestion(page, /adelantas al participante/);
    await page.getByRole("button", { name: "Falso" }).click();
    await waitForQuestion(page, /mangaka es el autor/);
    await page.getByRole("button", { name: "Hirohiko Araki" }).click();

    await expect(page.getByText("Desafío completado")).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText("Desafío completado")).toBeVisible();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await page.locator("details").nth(5).locator("summary").click();
    await expect(page.getByText(/El Gran Cañón está en el norte de Arizona/)).toBeVisible();
    await expect(page.getByText(/distancia|precisión/i).first()).toBeVisible();
  });

  test("el spectator ve la publicación pero no puede iniciar el desafío", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.spectator);
    await page.getByRole("link", { name: /Abrir sala Steel Ball Run/ }).click();
    await page.getByRole("link", { name: "Ver introducción" }).click();
    await expect(page.getByRole("heading", { name: "Steel Ball Run" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toHaveCount(0);
    expect(await page.content()).not.toContain("fullCreditRadius");
    expect(await page.content()).not.toContain("toleranceRadius");
  });
});
