import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readColorTokens, resolveColor, contrast } from "../scripts/test-utils/color-tokens.mjs";

const tokens = readColorTokens(readFileSync("app/globals.css", "utf8"));
for (const width of [390, 1280]) {
  test.describe(`Design tokens at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("resolves the UI kit pairs after the cascade and CSS Modules", async ({ page }) => {
      await page.goto("/demo/flash-pop/ui-kit");
      await expect(page.getByRole("heading", { name: "The Flash UI Kit" })).toBeVisible();
      const pairs = await page.locator("[data-token-pair]").evaluateAll((elements) =>
        elements.map((element) => {
          const el = element as HTMLElement;
          const style = getComputedStyle(el);
          return {
            id: el.dataset.tokenPair,
            background: el.dataset.background,
            foreground: el.dataset.foreground,
            border: el.dataset.border,
            bg: style.backgroundColor,
            fg: style.color,
            line: style.borderTopColor,
          };
        }),
      );
      expect(pairs).toHaveLength(60);
      for (const pair of pairs) {
        const bg = resolveColor(pair.bg);
        const fg = resolveColor(pair.fg);
        const expectedBg = resolveColor(`--ds-color-${pair.background}`, tokens);
        const expectedFg = resolveColor(`--ds-color-${pair.foreground}`, tokens);
        for (const channel of [0, 1, 2, 3]) {
          expect(bg[channel], `${pair.id} background`).toBeCloseTo(expectedBg[channel], 3);
          expect(fg[channel], `${pair.id} foreground`).toBeCloseTo(expectedFg[channel], 3);
        }
        expect(contrast(fg, bg), `${pair.id} text`).toBeGreaterThanOrEqual(4.5);
        if (
          pair.border &&
          !["border-subtle", "border-default", "border-hover", "border-brand"].includes(pair.border)
        ) {
          expect(
            contrast(resolveColor(pair.line), bg),
            `${pair.id} indicator`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
      // Exercise real primitives as well as token swatches: child styles can override a pair.
      for (const avatar of await page.locator('[role="img"][aria-label]').all()) {
        const colors = await avatar.evaluate((element) => {
          const style = getComputedStyle(element);
          return { fg: style.color, bg: style.backgroundColor };
        });
        const bg = resolveColor(colors.bg);
        if (bg[3] === 1) expect(contrast(resolveColor(colors.fg), bg)).toBeGreaterThanOrEqual(4.5);
      }
      const timers = await page.locator('[role="timer"]').evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          const unit = getComputedStyle(element.lastElementChild!);
          return { fg: style.color, bg: style.backgroundColor, unit: unit.color };
        }),
      );
      for (const timer of timers) {
        expect(contrast(resolveColor(timer.fg), resolveColor(timer.bg))).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(contrast(resolveColor(timer.unit), resolveColor(timer.bg))).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      const field = page.getByLabel("Correo electrónico");
      await field.focus();
      await expect(field).toHaveCSS("outline-color", "rgb(77, 59, 209)");
      await expect(field).toHaveCSS("outline-style", "solid");
      await expect(field).toHaveCSS("border-top-color", "rgb(167, 25, 48)");
      await page.emulateMedia({ reducedMotion: "reduce" });
      const button = page.getByRole("button", { name: "Jugar ahora" });
      const duration = await button.evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      );
      expect(duration.split(",").every((part) => parseFloat(part) <= 0.00001)).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  });
}
