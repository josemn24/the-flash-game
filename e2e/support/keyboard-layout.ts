import { expect, type Page } from "@playwright/test";

/** Stress a long question while checking that only its middle panel scrolls. */
export async function expectPinnedWordleKeyboard(page: Page) {
  const frame = page.locator("[data-keyboard-layout]");
  const scroll = frame.locator("[data-keyboard-scroll]");
  const dock = frame.locator("[data-keyboard-dock]");
  await expect(dock.getByRole("button", { name: "Enviar", exact: true })).toBeVisible();
  await expect(dock.getByRole("group", { name: "Teclado del juego" })).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await dock.boundingBox();
      return bounds!.y + bounds!.height;
    })
    .toBeLessThanOrEqual(page.viewportSize()!.height);
  const bottomSpacing = await frame.evaluate((element) => {
    const dock = element.querySelector<HTMLElement>("[data-keyboard-dock]");
    return {
      padding: Number.parseFloat(getComputedStyle(element).paddingBottom),
      gap: element.getBoundingClientRect().bottom - dock!.getBoundingClientRect().bottom,
    };
  });
  expect(bottomSpacing.padding).toBeGreaterThanOrEqual(16);
  // DOM geometry can round fractional viewport pixels; the CSS padding above remains 16px.
  expect(bottomSpacing.gap).toBeGreaterThanOrEqual(15);
  const originalScroll = await scroll.evaluate((element) => element.scrollTop);
  const pageScroll = await page.evaluate(() => window.scrollY);
  await scroll.evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.dataset.layoutSpacer = "";
    spacer.style.height = "800px";
    element.prepend(spacer);
    element.scrollTop = 0;
  });
  try {
    const initial = await frame.evaluate((element) => ({
      dock: element.querySelector("[data-keyboard-dock]")!.getBoundingClientRect().top,
      question: element
        .querySelector("[data-keyboard-scroll] h1, [data-keyboard-scroll] h2")!
        .getBoundingClientRect().top,
    }));
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const after = await frame.evaluate((element) => ({
      dock: element.querySelector("[data-keyboard-dock]")!.getBoundingClientRect().top,
      question: element
        .querySelector("[data-keyboard-scroll] h1, [data-keyboard-scroll] h2")!
        .getBoundingClientRect().top,
    }));
    expect(Math.abs(after.dock - initial.dock)).toBeLessThan(1);
    expect(after.question).toBeLessThan(initial.question);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  } finally {
    await scroll.evaluate((element, position) => {
      element.querySelector("[data-layout-spacer]")?.remove();
      element.scrollTop = position;
    }, originalScroll);
  }
}
