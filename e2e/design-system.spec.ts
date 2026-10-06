import { contrast, resolveColor } from "../scripts/test-utils/color-tokens.mjs";
import { test, expect, type Page } from "@playwright/test";
import { catalogGroups, catalogExamples } from "../features/design-system/registry";

const paths = catalogGroups.flatMap((group) => group.items.map((item) => item.href));
async function expectUniqueIds(page: Page) {
  const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
    const ids = elements.map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
}
for (const width of [390, 1280]) {
  test.describe(`Catalogue at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("visits every guide and isolated preview without a backend", async ({ page }) => {
      test.setTimeout(120_000);
      const backendRequests: string[] = [];
      const errors: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/") || request.url().includes(":54321"))
          backendRequests.push(request.url());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      for (const path of paths) {
        expect((await page.goto(path))?.status()).toBe(200);
        await expect(page.locator("main h1").first()).toBeVisible();
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
          "content",
          /noindex.*nofollow/,
        );
        if (width === 390)
          await expect(page.getByLabel("Sección del design system")).toHaveValue(path);
        else
          await expect(
            page
              .getByRole("navigation", { name: "Navegación del design system" })
              .locator('[aria-current="page"]'),
          ).toHaveAttribute("href", path);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          path,
        ).toBe(true);
        await expectUniqueIds(page);
        for (const frame of page.frames().filter((frame) => frame !== page.mainFrame())) {
          await expect(frame.locator("[data-example]")).toBeVisible();
          expect(
            await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          const ids = await frame
            .locator("[id]")
            .evaluateAll((elements) => elements.map((element) => element.id));
          expect(new Set(ids).size).toBe(ids.length);
        }
        if (path === "/design-system")
          await page.screenshot({
            path: `output/playwright/design-system-${width}.png`,
            fullPage: true,
          });
        if (
          ["feedback", "rankings", "revision"].some((slug) => path.endsWith(`/patrones/${slug}`))
        ) {
          if (path.endsWith("/feedback"))
            await expect(
              page.frameLocator("iframe").getByText("+100 puntos", { exact: true }),
            ).toHaveCSS("opacity", "1");
          await page
            .locator("iframe")
            .screenshot({ path: `output/playwright/${path.split("/").at(-1)}-${width}.png` });
        }
      }
      for (const example of catalogExamples) {
        expect((await page.goto(`/design-system/preview/${example.id}`))?.status()).toBe(200);
        await expect(page.locator(`[data-example="${example.id}"]`)).toBeVisible();
        await expectUniqueIds(page);
      }
      expect(backendRequests).toEqual([]);
      expect(errors).toEqual([]);
    });
    test("supports navigation, keyboard focus and local form recovery", async ({ page }) => {
      await page.goto("/design-system");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("#catalog-content")).toBeFocused();
      if (width === 390)
        await page
          .getByLabel("Sección del design system")
          .selectOption("/design-system/patrones/formularios");
      else
        await page
          .getByRole("navigation", { name: "Navegación del design system" })
          .getByRole("link", { name: "Formularios", exact: true })
          .click();
      await expect(page).toHaveURL(/\/patrones\/formularios$/);
      const field = page.getByLabel("Correo electrónico de ejemplo");
      await page.getByRole("button", { name: "Guardar correo de ejemplo" }).click();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator('[data-example="formularios"]').getByRole("alert")).toHaveText(
        "Introduce una dirección de correo válida.",
      );
      await field.fill("ana@example.com");
      await field.focus();
      await expect(field).toHaveCSS("outline-color", "rgb(77, 59, 209)");
      await page.getByRole("button", { name: "Guardar correo de ejemplo" }).click();
      await expect(field).toBeDisabled();
      await page.getByRole("button", { name: "Simular error de envío" }).click();
      await page.getByRole("button", { name: "Reintentar envío" }).click();
      await page.getByRole("button", { name: "Completar envío" }).click();
      await expect(page.getByText("Correo de ejemplo guardado", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Reiniciar formulario" }).click();
      await expect(field).toHaveValue("");
      await expect(field).not.toHaveAttribute("aria-invalid");
    });
    test("checks shared fields, native files and reflow at 200 percent", async ({ page }) => {
      await page.goto("/design-system/preview/formularios");
      await expectUniqueIds(page);
      for (const density of ["comfortable", "compact"] as const) {
        const expectedHeight = density === "comfortable" ? 56 : 44;
        const field = page.getByLabel(`Nombre · ${density}`, { exact: true });
        const select = page.getByLabel(`Rol · ${density}`, { exact: true });
        const notes = page.getByLabel(`Notas · ${density}`, { exact: true });
        for (const control of [field, select]) {
          await expect(control).toHaveCSS("min-height", `${expectedHeight}px`);
          await expect(control).toHaveCSS("font-size", "16px");
          await expect(control).toHaveCSS(
            "padding-left",
            density === "comfortable" ? "16px" : "12px",
          );
          const colors = await control.evaluate((element) => {
            const style = getComputedStyle(element);
            return { fg: style.color, bg: style.backgroundColor, border: style.borderTopColor };
          });
          expect(contrast(resolveColor(colors.fg), resolveColor(colors.bg))).toBeGreaterThanOrEqual(
            4.5,
          );
          expect(
            contrast(resolveColor(colors.border), resolveColor(colors.bg)),
          ).toBeGreaterThanOrEqual(3);
        }
        await expect(field.locator("..")).toHaveCSS(
          "row-gap",
          density === "comfortable" ? "8px" : "4px",
        );
        await expect(notes).toHaveAttribute("rows", "3");
        await expect(notes).toHaveCSS("resize", "vertical");
        await expect(notes).toHaveCSS("line-height", "24px");
        await expect(page.getByLabel(`Documento · ${density}`, { exact: true })).toHaveAttribute(
          "readonly",
          "",
        );
        await expect(page.getByLabel(`Deshabilitado · ${density}`, { exact: true })).toBeDisabled();
        const invalid = page.getByLabel(`Campo con error · ${density}`, { exact: true });
        await expect(invalid).toHaveAttribute("aria-invalid", "true");
        await expect(invalid).toHaveCSS("border-top-color", "rgb(167, 25, 48)");
        const referenced = await invalid.evaluate((element) =>
          (element.getAttribute("aria-describedby") || "")
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent),
        );
        expect(referenced).toEqual([
          "Ayuda y error pueden coexistir.",
          "Ejemplo de error local; revisa este valor.",
        ]);
        const errorColor = await invalid
          .locator("..")
          .locator('div[id$="-error"]')
          .evaluate((el) => getComputedStyle(el).color);
        expect(contrast(resolveColor(errorColor), resolveColor("#ffffff"))).toBeGreaterThanOrEqual(
          4.5,
        );
        await field.focus();
        await expect(field).toHaveCSS("outline-width", "2px");
        await expect(field).toHaveCSS("outline-offset", "3px");
        await page.keyboard.press("Tab");
        await expect(select).toBeFocused();
        await select.selectOption("admin");
        await expect(select).toHaveValue("admin");
        const file = page.getByLabel(`Archivo · ${density}`, { exact: true });
        await file.setInputFiles({
          name: "un-nombre-de-archivo-muy-largo-para-comprobar-reflow.png",
          mimeType: "image/png",
          buffer: Buffer.from([137, 80, 78, 71]),
        });
        expect(await file.evaluate((el) => (el as HTMLInputElement).files?.[0]?.name)).toContain(
          "reflow.png",
        );
        await field.fill("Un nombre largo con caracteres que exceden el espacio visible");
      }
      await page.screenshot({ path: `output/playwright/forms-${width}.png`, fullPage: true });
      // CSS zoom applies an actual 2x scale, unlike deviceScaleFactor, which only changes pixels.
      await page.evaluate(() => {
        document.documentElement.style.zoom = "2";
      });
      await page.screenshot({
        path: `output/playwright/forms-${width}-zoom-200.png`,
        fullPage: true,
      });
      const zoomMetrics = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: innerWidth,
        body: document.body.getBoundingClientRect().width,
      }));
      expect(zoomMetrics.scroll, JSON.stringify(zoomMetrics)).toBeLessThanOrEqual(width + 1);
      for (const control of await page.locator("input:not(:disabled), select, textarea").all()) {
        const box = await control.boundingBox();
        expect(box?.width).toBeGreaterThan(0);
        expect((box?.x || 0) + (box?.width || 0)).toBeLessThanOrEqual(width + 1);
      }
    });
    test("resets action, timer, ranking, feedback and review demos", async ({ page }) => {
      await page.goto("/design-system/componentes/botones");
      const save = page.getByRole("button", { name: "Guardar ejemplo", exact: true });
      await save.click();
      await expect(save).toBeDisabled();
      await page.getByRole("button", { name: "Completar simulación" }).click();
      await expect(save).toBeEnabled();
      await page.getByRole("button", { name: "Reiniciar ejemplo" }).click();
      await expect(page.getByRole("status")).toHaveText("Sin acciones todavía.");
      await page.goto("/design-system/componentes/temporizadores");
      await page.getByRole("button", { name: "Iniciar cuenta", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Iniciar cuenta", exact: true }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Reiniciar cuenta" }).click();
      await expect(page.getByRole("status")).toHaveText("Cuenta preparada.");
      await page.goto("/design-system/patrones/rankings");
      const ranking = page.frameLocator('iframe[title="Clasificación con datos ficticios"]');
      await ranking.getByLabel("Presentación del ranking").selectOption("cards");
      await ranking.getByRole("button", { name: /Ver detalle de Ana Moreno/ }).click();
      await expect(
        ranking.getByRole("button", { name: /Ver detalle de Ana Moreno/ }),
      ).toHaveAttribute("aria-pressed", "true");
      await ranking.getByLabel("Lista vacía").check();
      await expect(ranking.getByText("Todavía no hay participantes en esta demo.")).toBeVisible();
      await ranking.getByRole("button", { name: "Reiniciar ranking" }).click();
      await expect(ranking.getByLabel("Presentación del ranking")).toHaveValue("rows");
      await page.goto("/design-system/patrones/feedback");
      const feedback = page.frameLocator('iframe[title="Resultados y recuperación"]');
      await page.getByLabel("Estado de respuesta").selectOption("incorrect");
      await expect(feedback.getByRole("heading", { name: "Respuesta fallada" })).toBeVisible();
      await page.getByLabel("Inline", { exact: true }).check();
      await expect(feedback.getByText("El siguiente paso se decide en esta demo.")).toHaveCount(0);
      await page.getByRole("button", { name: "Reiniciar feedback" }).click();
      await expect(page.getByLabel("Estado de respuesta")).toHaveValue("correct");
      await page.goto("/design-system/patrones/revision");
      const review = page.frameLocator('iframe[title="Historial de ejemplo"]');
      await expect(review.locator("details").first()).toHaveAttribute("open", "");
      await review.locator("summary").first().click();
      await expect(review.locator("details").first()).not.toHaveAttribute("open", "");
      await review.getByRole("button", { name: "Reiniciar revisión" }).click();
      await expect(review.locator("details").first()).toHaveAttribute("open", "");
      await expectUniqueIds(page);
    });
    test("keeps avatar, navigation, surface and loading controls local", async ({ page }) => {
      await page.goto("/design-system/componentes/avatares");
      await page.getByLabel("Avatares visibles").selectOption("2");
      await expect(page.locator('[aria-label="4 personas más"]')).toBeVisible();
      await page.getByRole("button", { name: "Reiniciar ejemplo" }).click();
      await expect(page.getByLabel("Avatares visibles")).toHaveValue("3");
      await page.goto("/design-system/componentes/navegacion");
      await page.getByRole("button", { name: "Alternar identidad" }).click();
      await expect(page.getByText("Contexto propio", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Volver en el ejemplo" }).click();
      await expect(page.getByRole("status")).toHaveText("Has vuelto al contexto anterior.");
      await page.getByRole("button", { name: "Reiniciar ejemplo" }).click();
      await expect(page.getByRole("status")).toHaveText("Contexto inicial.");
      await page.goto("/design-system/componentes/superficies");
      const surfaces = page.frameLocator('iframe[title="Canvas y tarjetas reales"]');
      await surfaces.getByLabel("Anchura de Canvas").selectOption("wide");
      await surfaces.getByRole("button", { name: "Reiniciar ejemplo" }).click();
      await expect(surfaces.getByLabel("Anchura de Canvas")).toHaveValue("content");
      await page.goto("/design-system/patrones/feedback");
      const feedback = page.frameLocator('iframe[title="Resultados y recuperación"]');
      await page.getByLabel("Tipo de feedback").selectOption("operacion");
      await feedback.getByRole("button", { name: "Simular error", exact: true }).click();
      await feedback.getByRole("button", { name: "Reintentar operación" }).click();
      await expect(feedback.getByText("Enviando el ejemplo…")).toBeVisible();
      await feedback.getByRole("button", { name: "Completar operación" }).click();
      await expect(feedback.getByText("Operación de ejemplo completada.")).toBeVisible();
      await page.getByRole("button", { name: "Reiniciar feedback" }).click();
      await expect(feedback.getByRole("heading", { name: "Respuesta correcta" })).toBeVisible();
      await page.goto("/design-system/patrones/carga-vacio");
      const loading = page.frameLocator('iframe[title="Cambiar entre carga, vacío y contenido"]');
      await page.getByLabel("Estado del contenido").selectOption("vacio");
      await expect(loading.getByText("Todavía no hay datos en este ejemplo.")).toBeVisible();
      await page.getByLabel("Estado del contenido").selectOption("contenido");
      await expect(loading.getByRole("status")).toHaveText("Contenido de ejemplo cargado.");
      await page.getByRole("button", { name: "Reiniciar estado" }).click();
      await expect(page.getByLabel("Estado del contenido")).toHaveValue("ranking");
      await expect(loading.locator('[aria-busy="true"]')).toBeVisible();
    });
  });
}
test("resolves token values and compatibility redirects", async ({ page }) => {
  await page.goto("/demo/flash-pop/ui-kit");
  await expect(page).toHaveURL(/\/design-system$/);
  await page.goto("/flash-pop/ui-kit");
  await expect(page).toHaveURL(/\/design-system$/);
  await page.goto("/design-system/fundamentos");
  await expect(page.locator('[data-token-value="--space-6"]')).toHaveText("24px");
  expect(await page.locator("[data-token-value]").allTextContents()).not.toContain("Sin valor");
  for (const path of [
    "/design-system/unknown",
    "/design-system/componentes/missing",
    "/design-system/patrones/missing",
    "/design-system/preview/missing",
  ]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
    await expect(page.locator("body")).toHaveText("Not Found");
  }
});
