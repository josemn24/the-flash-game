import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

type Fixture = {
  users: { member: { email: string; password: string } };
};

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function fillLogin(page: Page) {
  const fixture = JSON.parse(await readFile("output/fixtures/portal.json", "utf8")) as Fixture;
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(fixture.users.member.email);
  await page.getByLabel("Contraseña").fill(fixture.users.member.password);
}

const tokenRoute = /\/auth\/v1\/token\?grant_type=password$/;

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`Estados del login — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("mantiene el bloqueo durante la autenticación y la entrada a la portada", async ({
      page,
    }) => {
      const authentication = gate();
      const home = gate();
      let tokenRequests = 0;
      let refreshRequests = 0;
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));

      await page.route(tokenRoute, async (route) => {
        tokenRequests++;
        await authentication.promise;
        await route.continue();
      });
      await page.route(
        (url) => url.pathname === "/",
        async (route) => {
          if (route.request().headers().rsc === "1") {
            refreshRequests++;
            await home.promise;
          }
          await route.continue();
        },
      );

      try {
        await fillLogin(page);
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        const loading = page.getByRole("button", { name: "Iniciando sesión…" });
        await expect(loading).toBeDisabled();
        await expect(loading).toHaveAttribute("aria-busy", "true");
        await expect(page.getByLabel("Correo electrónico")).toBeDisabled();
        await expect(page.getByLabel("Contraseña")).toBeDisabled();
        await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
        await expect(page.getByRole("status")).toHaveText("Iniciando sesión…");
        await expect.poll(() => tokenRequests).toBe(1);

        const spinner = loading.locator('span[aria-hidden="true"]');
        await expect(spinner).toHaveCSS("width", "18px");
        await expect(spinner).toHaveCSS("height", "18px");
        await expect(spinner).toHaveCSS("border-top-width", "2px");
        await expect(spinner).toHaveCSS("animation-name", /spin/);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(spinner).toHaveCSS("animation-name", "none");
        await page.emulateMedia({ reducedMotion: "no-preference" });

        await mkdir("output/playwright/login", { recursive: true });
        await page.screenshot({
          path: `output/playwright/login/${viewport.name}-loading.png`,
          fullPage: true,
        });
        await page.locator("form").evaluate((form) => {
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        expect(tokenRequests).toBe(1);

        authentication.release();
        await expect(page.getByRole("status")).toHaveText("Entrando…");
        await expect.poll(() => refreshRequests).toBe(1);
        await expect(page.getByRole("button", { name: "Entrando…" })).toBeDisabled();
        await expect(page.getByLabel("Correo electrónico")).toBeDisabled();
        await expect(page.getByLabel("Contraseña")).toBeDisabled();
        await expect(page.getByRole("main").getByRole("alert")).toBeEmpty();

        home.release();
        await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
        await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
        expect(tokenRequests).toBe(1);
        expect(pageErrors).toEqual([]);
      } finally {
        authentication.release();
        home.release();
      }
    });

    test("muestra errores accesibles y permite recuperarse sin perder los datos", async ({
      page,
    }) => {
      let attempts = 0;
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));
      await page.route(tokenRoute, async (route) => {
        attempts++;
        if (attempts === 1) {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              error_code: "invalid_credentials",
              msg: "internal-provider-detail",
            }),
          });
        } else if (attempts === 2) {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ msg: "internal-provider-detail" }),
          });
        } else if (attempts === 3) {
          await route.abort("internetdisconnected");
        } else {
          await route.continue();
        }
      });

      await fillLogin(page);
      const email = page.getByLabel("Correo electrónico");
      const password = page.getByLabel("Contraseña");
      const originalEmail = await email.inputValue();
      const originalPassword = await password.inputValue();
      const submit = page.getByRole("button", { name: "Iniciar sesión", exact: true });
      const alert = page.getByRole("main").getByRole("alert");

      await submit.click();
      await expect(alert).toHaveText("Correo o contraseña incorrectos. Revisa tus datos.");
      await expect(submit).toBeEnabled();
      await expect(email).toHaveAttribute("aria-describedby", "auth-error");
      await expect(password).toHaveAttribute("aria-invalid", "true");
      await expect(alert).toHaveCSS(
        "background-color",
        await page.evaluate(() => {
          const element = document.createElement("span");
          element.style.color = "var(--color-danger)";
          document.body.append(element);
          const color = getComputedStyle(element).color;
          element.remove();
          return color;
        }),
      );
      expect(await page.locator("body").innerText()).not.toContain("internal-provider-detail");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await mkdir("output/playwright/login", { recursive: true });
      await page.screenshot({
        path: `output/playwright/login/${viewport.name}-error.png`,
        fullPage: true,
      });

      await email.fill(`${originalEmail}x`);
      await expect(alert).toBeEmpty();
      await expect(email).not.toHaveAttribute("aria-describedby");
      await email.fill(originalEmail);
      await submit.click();
      await expect(alert).toHaveText("El servicio no está disponible ahora. Inténtalo de nuevo.");
      await expect(email).not.toHaveAttribute("aria-invalid");
      await expect(password).not.toHaveAttribute("aria-describedby");
      await expect(email).toHaveValue(originalEmail);
      await expect(password).toHaveValue(originalPassword);

      await submit.click();
      await expect(alert).toHaveText(
        "No hemos podido conectar. Comprueba tu conexión y vuelve a intentarlo.",
      );
      await expect(submit).toBeEnabled();
      await expect(page.getByRole("status")).toBeEmpty();
      await submit.click();
      await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
      expect(attempts).toBe(4);
      expect(pageErrors).toEqual([]);
    });
  });
}
