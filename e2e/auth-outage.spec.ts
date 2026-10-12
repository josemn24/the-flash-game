import { expect, test } from "@playwright/test";
import { syntheticSession } from "../test-utils/supabase-session";

const controlURL = `http://127.0.0.1:${process.env.AUTH_OUTAGE_UPSTREAM_PORT || "54329"}/__test/control`;
const notice = "No hemos podido conectar con el servicio. Inténtalo de nuevo en unos segundos.";

test.beforeEach(async ({ page, request }) => {
  await request.post(controlURL, { data: { mode: "healthy" } });
  // Compile and hydrate the route before measuring the Auth deadline.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});

for (const mode of ["connection", "service", "hang"] as const) {
  test(`conserva la sesión y permite recuperar la portada: ${mode}`, async ({
    page,
    context,
    request,
  }, testInfo) => {
    const { cookie } = syntheticSession();
    await context.addCookies([{ ...cookie, url: testInfo.project.use.baseURL! }]);
    await request.post(controlURL, { data: { mode } });
    const start = Date.now();
    await page.goto("/");
    await expect(page.getByText(notice)).toBeVisible({ timeout: 6000 });
    const durationMs = Date.now() - start;
    expect(durationMs).toBeLessThan(6000);
    await testInfo.attach(`auth-${mode}-timing`, {
      body: JSON.stringify({ durationMs }),
      contentType: "application/json",
    });
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toHaveCount(0);
    expect((await context.cookies()).find((value) => value.name === cookie.name)?.value).toBe(
      cookie.value,
    );
    const state = await (await request.get(controlURL)).json();
    expect(state.authRequests).toBe(1);

    await request.post(controlURL, { data: { mode: "healthy" } });
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
    await expect(page.getByText(notice)).toHaveCount(0);
    expect((await context.cookies()).some((value) => value.name === cookie.name)).toBe(true);
  });
}

test("muestra el login sin sesión aunque Auth no responda", async ({ page, request }) => {
  await request.post(controlURL, { data: { mode: "hang" } });
  const start = Date.now();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  expect(Date.now() - start).toBeLessThan(6000);
  expect((await (await request.get(controlURL)).json()).authRequests).toBe(0);
});

test("devuelve JSON 503 para una API protegida durante la caída", async ({
  page,
  context,
  request,
}, testInfo) => {
  // Warm this separate route before measuring its authentication path.
  await context.request.post("/api/competitive/attempts/start", {
    headers: { origin: testInfo.project.use.baseURL! },
    data: {},
  });
  const { cookie } = syntheticSession();
  await context.addCookies([{ ...cookie, url: testInfo.project.use.baseURL! }]);
  await request.post(controlURL, { data: { mode: "connection" } });
  const response = await context.request.post("/api/competitive/attempts/start", {
    headers: { origin: testInfo.project.use.baseURL! },
    data: {},
  });
  expect(response.status()).toBe(503);
  expect((await response.json()).error.code).toBe("auth_unavailable");
  expect((await (await request.get(controlURL)).json()).authRequests).toBe(1);
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});

test("una sesión invalidada vuelve al login y elimina la cookie", async ({
  page,
  context,
  request,
}, testInfo) => {
  const { cookie } = syntheticSession();
  await context.addCookies([{ ...cookie, url: testInfo.project.use.baseURL! }]);
  await request.post(controlURL, { data: { mode: "invalid" } });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  expect((await context.cookies()).some((value) => value.name === cookie.name)).toBe(false);
});

test("el navegador no puede imponer un fallo de servicio con cabeceras internas", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-flash-auth-failure": "service",
    "x-flash-auth-deadline": "1",
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByText(notice)).toHaveCount(0);
});

test("el login sale del estado pendiente ante un timeout y conserva los campos", async ({
  page,
  request,
}) => {
  await request.post(controlURL, { data: { mode: "hang" } });
  await page.getByLabel("Correo electrónico").fill("outage@example.com");
  await page.getByLabel("Contraseña").fill("synthetic-password");
  const start = Date.now();
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator("#auth-error")).toHaveText(
    "El servicio no está disponible ahora. Inténtalo de nuevo.",
    { timeout: 6000 },
  );
  expect(Date.now() - start).toBeLessThan(6000);
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
  await expect(page.getByLabel("Contraseña")).toHaveValue("synthetic-password");
  await request.post(controlURL, { data: { mode: "healthy" } });
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
});

test("mantiene los códigos de rate limit y logout", async ({ page, request }) => {
  await request.post(controlURL, { data: { mode: "rate_limit" } });
  await page.getByLabel("Correo electrónico").fill("outage@example.com");
  await page.getByLabel("Contraseña").fill("synthetic-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator("#auth-error")).toHaveText(
    "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
  );
  await request.post(controlURL, { data: { mode: "healthy" } });
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});
