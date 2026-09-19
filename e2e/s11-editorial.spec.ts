import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

type FixtureAccount = { email: string; password: string };
type Fixture = {
  users: {
    superadmin: FixtureAccount;
    member: FixtureAccount;
  };
};

async function fixture() {
  return JSON.parse(await readFile("output/fixtures/s11.json", "utf8")) as Fixture;
}

async function signIn(page: Page, account: FixtureAccount) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Mis salas" })).toBeVisible();
}

const editorialDocument = {
  challenge: {
    slug: "flash-s11-e2e",
    title: "Flash S11 E2E",
    subtitle: "Cinco preguntas",
    description: "Desafío editorial creado desde el portal.",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: [
    ...Array.from({ length: 3 }, (_, index) => ({
      slug: `e2e-${index + 1}`,
      type: "multiple-choice" as const,
      payloadSchemaVersion: 1 as const,
      timeLimitMs: 15000,
      points: 20,
      publicPayload: {
        category: index % 2 === 0 ? "Cultura" : "Ciencia",
        tags: {},
        question: `¿Pregunta E2E ${index + 1}?`,
        options: ["A", "B"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: { correctAnswer: "A", explanation: `Respuesta ${index + 1}.` },
    })),
    {
      slug: "e2e-anagram",
      type: "anagram" as const,
      payloadSchemaVersion: 1 as const,
      timeLimitMs: 30000,
      points: 20,
      publicPayload: {
        category: "Deporte",
        tags: {},
        question: "Forma una palabra relacionada con el desafío.",
        tiles: [
          { id: "a", value: "A" },
          { id: "c", value: "C" },
          { id: "r-1", value: "R" },
          { id: "r-2", value: "R" },
          { id: "a-2", value: "A" },
          { id: "e", value: "E" },
          { id: "r-3", value: "R" },
        ],
        hint: null,
      },
      solutionPayload: { correctAnswer: "CARRERA", explanation: "La palabra es carrera." },
    },
    {
      slug: "e2e-classification",
      type: "classification" as const,
      payloadSchemaVersion: 1 as const,
      timeLimitMs: 22000,
      points: 20,
      publicPayload: {
        category: "Tecnología",
        tags: {},
        question: "Clasifica cada objeto.",
        items: [{ label: "Brújula" }, { label: "Navegador GPS" }],
        categories: ["útil en 1890", "anacrónico"],
      },
      solutionPayload: {
        categoriesByItem: { "Brújula": "útil en 1890", "Navegador GPS": "anacrónico" },
        explanation: "Clasificación histórica.",
      },
    },
  ],
};

test.describe("S11 — publicar contenido mínimo", () => {
  test("el superadmin crea, edita, previsualiza y publica Flash", async ({ page }) => {
    const data = await fixture();
    const suffix = Date.now().toString(36);
    const draftDocument = {
      ...editorialDocument,
      challenge: { ...editorialDocument.challenge, slug: `flash-s11-e2e-${suffix}` },
      questions: editorialDocument.questions.map((question, index) => ({
        ...question,
        slug: `e2e-${suffix}-${index + 1}`,
      })),
    };
    await signIn(page, data.users.superadmin);
    await page.goto("/admin");

    const editor = page.getByRole("region", { name: "Contenido Flash" });
    const textarea = editor.getByLabel("Documento editorial JSON");
    await textarea.fill(JSON.stringify(draftDocument, null, 2));
    await editor.getByLabel("Motivo de auditoría").first().fill("Crear contenido S11");
    await editor.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page).toHaveURL(/\/admin\?editorial=saved$/);
    await page.reload();

    await expect(editor.getByRole("heading", { name: "Flash S11 E2E", exact: true })).toBeVisible();
    await expect(editor.getByText("Flash · 5 preguntas · 100 puntos")).toBeVisible();
    await textarea.fill(JSON.stringify({
      ...draftDocument,
      challenge: { ...draftDocument.challenge, title: "Flash S11 E2E editado" },
    }, null, 2));
    const reasons = editor.getByLabel("Motivo de auditoría");
    await reasons.first().fill("Editar contenido S11");
    await editor.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page).toHaveURL(/\/admin\?editorial=saved$/);
    await page.reload();

    await expect(editor.getByRole("heading", { name: "Flash S11 E2E editado", exact: true }).first()).toBeVisible();
    await editor.getByLabel("Motivo de auditoría").last().fill("Publicar contenido S11");
    page.once("dialog", (dialog) => dialog.accept());
    await editor.getByRole("button", { name: "Publicar versión" }).click();
    await expect(page).toHaveURL(/\/admin\?editorial=published$/);
    await expect(editor.getByText("Publicado").first()).toBeVisible();
    await expect(editor.getByText("Sin intento ni puntuación")).toBeVisible();
  });

  test("un miembro no ve editor, borradores ni soluciones", async ({ page }) => {
    const data = await fixture();
    await signIn(page, data.users.member);
    await page.goto("/admin");
    await expect(page.getByText("Acceso no disponible")).toBeVisible();
    await expect(page.getByText("Contenido Flash")).toHaveCount(0);
    await expect(page.getByText("Solución privada")).toHaveCount(0);
  });
});
