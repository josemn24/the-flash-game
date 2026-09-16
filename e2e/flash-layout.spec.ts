import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type BrowserFixture = {
  users: { owner: { email: string; password: string } };
  data: { roomSlug: string; openPublicationId: string };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/browser.json", "utf8")) as BrowserFixture;
}

async function signIn(page: Page, account: BrowserFixture["users"]["owner"]) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

test.describe("Flash layout", () => {
  test.use({ viewport: { width: 406, height: 847 } });

  test("uses the shared mobile shell for the server-backed game", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.owner);
    await page.goto(`/desafios/${data.data.openPublicationId}?roomId=${data.data.roomSlug}`);
    await page.getByRole("button", { name: "Empezar desafío" }).click();

    const shell = page.locator('[data-gameplay-shell="flash-pop"]');
    await expect(shell).toHaveAttribute("data-gameplay-layout", "game");
    const answer = page.getByRole("button", { name: "Lisboa" });
    await expect(answer).toBeVisible({ timeout: 10_000 });

    const answerBox = await answer.boundingBox();
    expect(answerBox).not.toBeNull();
    expect(answerBox!.x).toBeGreaterThanOrEqual(20);
    expect(answerBox!.x + answerBox!.width).toBeLessThanOrEqual(386);
  });
});
