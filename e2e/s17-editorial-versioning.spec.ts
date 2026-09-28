import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = { users: { superadmin: FixtureAccount; member: FixtureAccount } };

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s17.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

async function publishQuestions(page: Page, suffix: string) {
  await page.goto("/admin/questions");
  await page.getByLabel("Buscar").fill(suffix);
  const links = page.locator("a[href^='/admin/questions/']:not([href$='/new'])");
  await expect(links).toHaveCount(2);
  const hrefs = await links.evaluateAll((items) =>
    items.map((item) => (item as HTMLAnchorElement).href),
  );
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.getByRole("button", { name: "Publicar versión" })).toBeVisible();
    await page.getByLabel("Motivo de auditoría").last().fill("Publicar preguntas S17");
    await page.getByRole("button", { name: "Publicar versión" }).click();
    await expect(page).toHaveURL(/\/admin\/questions\/[^/?]+$/);
  }
}

test.describe("S17 — corrección y versionado editorial", () => {
  test("clona, modifica, compara, publica y archiva una versión Flash", async ({ page }) => {
    const data = await fixture();
    const suffix = Date.now().toString(36);
    const document = {
      challenge: {
        slug: `flash-s17-e2e-${suffix}`,
        title: "Flash S17 E2E",
        subtitle: "Versión inicial",
        description: "Desafío usado para comprobar el historial editorial.",
        mode: "flash",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: [1, 2].map((index) => ({
        slug: `s17-e2e-${suffix}-${index}`,
        type: "multiple-choice",
        payloadSchemaVersion: 1,
        timeLimitMs: 15000,
        points: 50,
        publicPayload: {
          category: "S17",
          tags: {},
          question: `¿Pregunta S17 ${index}?`,
          options: ["A", "B"],
          media: null,
          promptVisual: null,
        },
        solutionPayload: { correctAnswer: "A", explanation: "Respuesta S17." },
      })),
    };

    await signIn(page, data.users.superadmin);
    await page.goto("/admin/challenges/new");
    const editor = page.locator("section[aria-labelledby='editorial-management-title']");
    await editor.getByLabel("Documento editorial JSON").fill(JSON.stringify(document, null, 2));
    await editor.getByLabel("Motivo de auditoría").first().fill("Crear contenido S17");
    await editor.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page).toHaveURL(/\/admin\/challenges\/[^/]+\?editorial=saved$/);
    const challengeUrl = page.url().split("?")[0];

    await publishQuestions(page, suffix);
    await page.goto(challengeUrl);
    await page.reload();
    const initialPublishForm = editor.locator("form").filter({ hasText: "Publicar versión" });
    await initialPublishForm.getByLabel("Motivo de auditoría").fill("Publicar contenido S17");
    page.once("dialog", (dialog) => dialog.accept());
    await initialPublishForm.getByRole("button", { name: "Publicar versión" }).click();
    await expect(page).toHaveURL(/editorial=published$/);

    const originalCard = page.locator("article").filter({ hasText: "v1" }).first();
    const revisionForm = originalCard.locator("form").filter({ hasText: "Crear corrección" });
    await revisionForm.getByLabel("Motivo de auditoría").fill("Crear corrección S17");
    await revisionForm.getByRole("button", { name: "Crear corrección" }).click();
    await expect(page).toHaveURL(/editorial=revision-created&draftId=/);
    await expect(editor.getByRole("heading", { name: "Editar borrador" })).toBeVisible();

    const textarea = editor.getByLabel("Documento editorial JSON");
    const corrected = JSON.parse(await textarea.inputValue()) as typeof document;
    corrected.challenge.title = "Flash S17 E2E corregido";
    await textarea.fill(JSON.stringify(corrected, null, 2));
    await editor.getByLabel("Motivo de auditoría").first().fill("Editar corrección S17");
    await editor.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page).toHaveURL(/editorial=saved$/);
    await page.reload();
    const correctedPublishForm = editor.locator("form").filter({ hasText: "Publicar versión" });
    await correctedPublishForm.getByLabel("Motivo de auditoría").fill("Publicar corrección S17");
    page.once("dialog", (dialog) => dialog.accept());
    await correctedPublishForm.getByRole("button", { name: "Publicar versión" }).click();
    await expect(page).toHaveURL(/editorial=published$/);
    await expect(page.locator("#editorial-management-title")).toHaveText("Flash S17 E2E corregido");

    const compareFrom = page.locator("select[name='compareFrom']");
    const versions = await compareFrom.locator("option").evaluateAll((items) =>
      items.map((item) => (item as HTMLOptionElement).value),
    );
    expect(versions.length).toBeGreaterThanOrEqual(2);
    await compareFrom.selectOption(versions.at(-1)!);
    await page.locator("select[name='compareTo']").selectOption(versions[0]!);
    await page.getByRole("button", { name: "Comparar versiones" }).click();
    await expect(page.getByRole("heading", { name: /v1 → v2/ })).toBeVisible();
    await expect(page.getByText(/soluciones privadas no se muestran/)).toBeVisible();

    const historicalCard = page.locator("article").filter({ hasText: "v1" }).first();
    const archiveForm = historicalCard.locator("form").filter({ hasText: "Archivar versión" });
    await archiveForm.getByLabel("Motivo de auditoría").fill("Archivar versión S17");
    page.once("dialog", (dialog) => dialog.accept());
    await archiveForm.getByRole("button", { name: "Archivar versión" }).click();
    await expect(page).toHaveURL(/editorial=archived$/);
    await expect(page.locator("article").filter({ hasText: "v1" }).getByText("Archivado")).toBeVisible();
    await expect(
      page.locator("article").filter({ hasText: "v2" }).getByText("Publicado", { exact: true }),
    ).toBeVisible();
  });

  test("un miembro no accede al portal editorial", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.member);
    await page.goto("/admin");
    await expect(page.getByText("Acceso no disponible")).toBeVisible();
    await expect(page.getByText("Crear corrección")).toHaveCount(0);
  });
});
