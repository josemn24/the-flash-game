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

  test("Ches ve y juega Reino de animales como primera publicación de Tabarnia", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 406, height: 847 });
    await page.emulateMedia({ reducedMotion: "reduce" });
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
    await expect(page.getByRole("heading", { name: "Reino de animales" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
    await page.getByRole("button", { name: "Empezar desafío" }).click();
    await expect(
      page.getByRole("heading", { name: "Mamífero protegido por una coraza de placas óseas." }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-gameplay-shell="flash-pop-alphabet"]')).toHaveAttribute(
      "data-gameplay-layout",
      "playing",
    );
    const viewportRight = 386;
    const board = await page
      .getByRole("list", { name: "Estado de las letras" })
      .locator("..")
      .boundingBox();
    const question = await page
      .getByRole("heading", {
        name: "Mamífero protegido por una coraza de placas óseas.",
      })
      .boundingBox();
    const answer = await page.getByRole("textbox", { name: "Tu respuesta" }).boundingBox();
    expect(board).not.toBeNull();
    expect(question).not.toBeNull();
    expect(answer).not.toBeNull();
    for (const [label, box] of [
      ["tablero", board!],
      ["pregunta", question!],
      ["campo de respuesta", answer!],
    ] as const) {
      expect(box.x).toBeGreaterThanOrEqual(20);
      expect(box.x + box.width, `${label} rebasa el margen derecho`).toBeLessThanOrEqual(
        viewportRight,
      );
    }
    await expect(page.getByText(/^Solución:/)).toHaveCount(0);
    let failFirstAnswer = true;
    await page.route(/\/api\/competitive\/attempts\/[^/]+\/answer$/, async (route) => {
      if (failFirstAnswer) {
        failFirstAnswer = false;
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.getByLabel("Tu respuesta").fill("armadillo");
    await page.getByRole("button", { name: "Responder" }).click();
    await expect(
      page.getByText("No se ha podido confirmar la respuesta.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Responder" })).toBeEnabled();
    await page.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByRole("status").getByText("Correcto")).toBeVisible();
    await page.unroute(/\/api\/competitive\/attempts\/[^/]+\/answer$/);

    expect(data.data.publicationId).toBe(data.data.publications[0]?.id);
    expect(data.data.publications[0]).toMatchObject({
      title: "Reino de animales",
      mode: "alphabet",
      status: "open",
    });
    expect(data.data.publications[1]).toMatchObject({
      title: "Biblia y religiones abrahámicas",
      mode: "pyramid",
      status: "scheduled",
    });
    expect(data.data.publications[2]).toMatchObject({
      title: "Steel Ball Run",
      mode: "flash",
      status: "scheduled",
    });
    expect(data.data.publications[3]).toMatchObject({
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
