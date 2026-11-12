import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  drawConexionesPaths,
  reachConexiones,
  reachOrden,
  sevenPointPaths,
} from "./support/cumbre-logica";
import { dockerSql } from "../scripts/support/supabase-local.mjs";

type Account = { email: string; password: string };
type Fixture = {
  users: { ches: Account; dark: Account; xesmona: Account };
  data: {
    room: { slug: string };
    publicationId: string;
    seasonId: string;
    publications: Array<{
      id: string;
      number: number;
      title: string;
      mode: string;
      status: string;
    }>;
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

  test("muestra la superficie 404 para una sala inexistente o no autorizada", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.xesmona);

    await page.goto("/salas/sala-inexistente/ajustes");
    await expect(page.getByText("Error 404", { exact: true })).toBeVisible();

    await page.goto(`/salas/${data.data.room.slug}/ajustes`);
    await expect(page.getByText("Error 404", { exact: true })).toBeVisible();
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

  test("Ches ve y juega Steel Ball Run como primera publicación de Tabarnia", async ({ page }) => {
    await page.setViewportSize({ width: 406, height: 847 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const data = await fixture();
    await signIn(page, data.users.ches);
    await page.getByRole("link", { name: /Abrir sala Tabarnia/ }).click();

    await page.getByRole("link", { name: /Ver ranking de la sala/ }).click();
    for (const label of ["Ches", "Dark", "Jacobo"]) {
      const avatar = data.data.avatars.find((item) => item.label === label.toLowerCase());
      expect(avatar).toBeDefined();
      const image = page.getByRole("img", { name: label }).first().locator("img");
      await expect(image).toHaveAttribute(
        "src",
        expect.stringContaining(encodeURIComponent(avatar!.objectPath)),
      );
      await expect
        .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
        .toBeGreaterThan(0);
    }
    await page.getByRole("link", { name: "Volver al detalle de la sala" }).click();

    await page.getByRole("link", { name: "Jugar" }).click();
    await expect(page.getByRole("heading", { name: "Steel Ball Run" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desafío" })).toBeVisible();
    await page.getByRole("button", { name: "Empezar desafío" }).click();
    await expect(page.getByText(/Caballo de Fuego/).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/^Solución:/)).toHaveCount(0);
    let answerRequests = 0;
    await page.route(/\/api\/competitive\/attempts\/[^/]+\/answer$/, async (route) => {
      answerRequests += 1;
      if (answerRequests === 1) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "La cultura china" }).click();
    await expect(page.getByText(/familia de los équidos/).first()).toBeVisible();
    expect(answerRequests).toBe(2);
    await page.unroute(/\/api\/competitive\/attempts\/[^/]+\/answer$/);

    expect(data.data.publicationId).toBe(data.data.publications[0]?.id);
    expect(data.data.publications[0]).toMatchObject({
      title: "Steel Ball Run",
      mode: "flash",
      status: "open",
    });
    expect(data.data.publications[1]).toMatchObject({
      title: "Reino de animales",
      mode: "alphabet",
      status: "scheduled",
    });
    expect(data.data.publications[2]).toMatchObject({
      title: "Queens",
      mode: "time-trial",
      status: "scheduled",
    });
    expect(data.data.publications[3]).toMatchObject({
      title: "España",
      mode: "survival",
      status: "scheduled",
    });
    expect(data.data.publications[4]).toMatchObject({
      title: "Cumbre lógica",
      mode: "pyramid",
      status: "scheduled",
    });
    expect(data.data.publications[5]).toMatchObject({
      title: "Multiverso friki",
      mode: "alphabet",
      status: "scheduled",
    });
    expect(data.data.publications[6]).toMatchObject({
      title: "Flow Free",
      mode: "time-trial",
      status: "scheduled",
    });
    expect(data.data.publications[7]).toMatchObject({
      title: "La Biblia",
      mode: "pyramid",
      status: "scheduled",
    });
  });

  test("xesmona queda fuera de la sala competitiva", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.xesmona);
    await expect(page.getByRole("link", { name: /Abrir sala Tabarnia/ })).toHaveCount(0);
  });

  test("Tabarniaverso abre como noveno desafío y permite jugar y revisar los nueve formatos", async ({
    page,
  }) => {
    test.skip(!process.env.SUPABASE_TEST_WORKDIR, "Requiere el stack desechable de E2E.");
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { data, users } = await fixture();
    const publication = data.publications[8];
    expect(publication).toMatchObject({
      number: 9,
      title: "Tabarniaverso",
      mode: "flash",
      status: "scheduled",
    });
    const url = `/desafios/${publication.id}?roomId=${data.room.slug}`;
    const start = page.getByRole("button", { name: "Empezar desafío" });
    const firstQuestion = page.getByRole("heading", {
      name: "¿Quiénes fueron los «padres» de la saga Assassin’s Creed?",
      exact: true,
    });

    await signIn(page, users.dark);
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Tabarniaverso" }).first()).toBeVisible();
    await expect(start).toHaveCount(0);
    await expect(firstQuestion).toHaveCount(0);

    await dockerSql(`begin;
      update public.scheduled_challenges
        set status = 'cancelled', cancelled_at = clock_timestamp()
        where season_id = '${data.seasonId}' and status = 'open';
      update public.scheduled_challenges
        set opens_at = clock_timestamp() + interval '200 milliseconds',
            closes_at = clock_timestamp() + interval '1 hour'
        where id = '${publication.id}';
      select pg_sleep(0.3);
      set local role service_role;
      select private.run_calendar_tick_command('{"runId":"tabarniaverso-e2e"}'::jsonb);
      commit;`);

    await page.goto(url);
    await start.click();
    await expect(firstQuestion).toBeVisible();
    await page.getByRole("button", { name: "Patrice Désilets y Jade Raymond" }).click();
    await page
      .getByRole("button", {
        name: "Acercarse al orgasmo y reducir o pausar la estimulación para retrasarlo.",
      })
      .click();
    await page.getByRole("button", { name: "Que tenga pito.", exact: true }).click();

    await page.getByRole("button", { name: "Mover Troposfera arriba" }).click();
    const moveStratosphere = page.getByRole("button", { name: "Mover Estratosfera arriba" });
    await moveStratosphere.click();
    await moveStratosphere.click();
    await page.getByRole("button", { name: "Confirmar orden" }).click();

    const estimation = page.getByRole("slider", { name: "Estimación en /100" });
    await expect(estimation).toHaveValue("90");
    await estimation.fill("96");
    await page.getByRole("button", { name: "Confirmar estimación" }).click();

    const verse = page.getByRole("heading", {
      name: /Completa Mateo 21:17.*a _____, y posó allí/,
    });
    await expect(verse).toBeInViewport();
    expect(await verse.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Betania" }).click();
    await page.getByRole("button", { name: "Miller" }).click();
    await page.getByRole("button", { name: "Verdadero" }).click();

    for (const [figure, tradition] of [
      ["Fenrir", "Nórdica"],
      ["Anubis", "Egipcia"],
      ["Cerbero", "Griega"],
      ["Quetzalcóatl", "Mexica"],
    ]) {
      await page.getByRole("button", { name: figure, exact: true }).click();
      await page.getByRole("button", { name: tradition, exact: true }).click();
    }
    await page.getByRole("button", { name: "Comprobar parejas" }).click();
    await page.getByRole("button", { name: "Circuito de Jerez" }).click();
    await page.getByRole("textbox", { name: "Escribe tu respuesta" }).fill("canberra");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
    await page.getByRole("button", { name: "Dos", exact: true }).click();
    await page.getByRole("button", { name: "Pokémon: Catch the Numbers!", exact: true }).click();
    await page.getByRole("button", { name: "El grito", exact: true }).click();

    await expect(page.getByText("Fue la capital del reino nabateo.")).toBeVisible();
    await page.getByRole("button", { name: /Revelar otra pista/ }).click();
    await expect(page.getByText("Sus ruinas se encuentran en la actual Jordania.")).toBeVisible();
    await page.getByRole("textbox", { name: "Escribe tu respuesta" }).fill("Petra");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();

    for (const [substance, category] of [
      ["Aire", "Mezcla"],
      ["Hierro", "Elemento"],
      ["Agua destilada", "Compuesto"],
      ["Helio", "Elemento"],
      ["Agua de mar", "Mezcla"],
      ["Dióxido de carbono", "Compuesto"],
    ]) {
      await page.getByRole("button", { name: `Clasificar ${substance} como ${category}` }).click();
    }
    await page.getByRole("button", { name: "Confirmar clasificación" }).click();

    await expect(page.locator("#challenge-result-title")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    const answers = page.locator("details");
    await expect(answers).toHaveCount(16);
    await expect(answers.filter({ has: page.getByText("Correcta", { exact: true }) })).toHaveCount(
      16,
    );
    await answers.filter({ hasText: "Completa Mateo 21:17" }).locator("summary").click();
    await expect(
      page.getByText(/Jesús salió de la ciudad y pasó la noche en Betania/),
    ).toBeVisible();
  });
});

test("Cumbre lógica recién instalada acredita los parciales de Orden y Conexiones", async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(!process.env.SUPABASE_TEST_WORKDIR, "Requiere el stack desechable de E2E.");
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { data, users } = await fixture();
  const publication = data.publications[4]!;
  expect(publication.title).toBe("Cumbre lógica");
  await dockerSql(`begin;
    update public.scheduled_challenges
      set status = 'cancelled', cancelled_at = clock_timestamp()
      where season_id = '${data.seasonId}' and status = 'open';
    update public.scheduled_challenges
      set opens_at = clock_timestamp() + interval '200 milliseconds',
          closes_at = clock_timestamp() + interval '1 hour'
      where id = '${publication.id}';
    select pg_sleep(0.3);
    set local role service_role;
    select private.run_calendar_tick_command('{"runId":"tabarnia-pyramid-credit-e2e"}'::jsonb);
    commit;`);

  const orderContext = await browser.newContext({ baseURL, reducedMotion: "reduce" });
  const orderPage = await orderContext.newPage();
  try {
    await signIn(orderPage, users.ches);
    await orderPage.goto(`/desafios/${publication.id}?roomId=${data.room.slug}`);
    await orderPage.getByRole("button", { name: "Empezar desafío" }).click();
    await reachOrden(orderPage);
    for (const item of ["Río", "Mar", "Luna"]) {
      await orderPage.getByRole("button", { name: `Mover ${item} arriba` }).click();
    }
    const answerResponse = orderPage.waitForResponse(
      (response) =>
        response.url().endsWith("/answer") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await orderPage.getByRole("button", { name: "Confirmar orden" }).click();
    expect(await (await answerResponse).json()).toMatchObject({
      status: "partial",
      points: 8,
      details: {
        type: "ordering",
        correctItems: 3,
        totalItems: 5,
        pyramidPartialCredit: "submission",
      },
    });
    await expect(orderPage.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
    await orderPage.reload();
    await expect(orderPage.getByText("+8 puntos en Orden")).toBeVisible();
    await orderPage.getByRole("button", { name: "Ver respuestas" }).click();
    await expect(orderPage.getByText("3 de 7 superados")).toBeVisible();
    await expect(orderPage.getByText("No alcanzado", { exact: true })).toHaveCount(3);
  } finally {
    await orderContext.close();
  }

  await signIn(page, users.dark);
  await page.goto(`/desafios/${publication.id}?roomId=${data.room.slug}`);
  await page.getByRole("button", { name: "Empezar desafío" }).click();
  const board = await reachConexiones(page);
  const completion = page.waitForResponse(
    (response) =>
      response.url().includes("/api/competitive/attempts/") &&
      response.url().endsWith("/complete") &&
      response.request().method() === "POST" &&
      response.ok(),
    { timeout: 45_000 },
  );
  await drawConexionesPaths(board, sevenPointPaths);
  const completed = await (await completion).json();
  expect(completed).toMatchObject({ outcome: "failed" });
  expect(completed.score).toBeGreaterThan(7);
  await expect(page.getByRole("heading", { name: "Ascenso terminado" })).toBeVisible();
  await expect(page.getByText("+7 puntos en Conexiones")).toBeVisible();
  await page.reload();
  await expect(page.getByText("+7 puntos en Conexiones")).toBeVisible();
  await page.getByRole("button", { name: "Ver respuestas" }).click();
  await expect(page.getByText("4 de 7 superados")).toBeVisible();
  await expect(page.getByText("No alcanzado", { exact: true })).toHaveCount(2);

  await dockerSql(`update public.scheduled_challenges set status = 'closed'
    where id = '${publication.id}';`);
  await page.goto(`/salas/${data.room.slug}/historial/${publication.id}`);
  await expect(
    page.getByLabel(new RegExp(`Dark, ${completed.score} Flash Points`)).first(),
  ).toBeVisible();
});
