import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  FlashEditorialDocument,
  SuperadminEditorialContext,
} from "@/types/view-models/editorial";
import { EditorialManagement } from "./EditorialManagement.client";

const document: FlashEditorialDocument = {
  challenge: {
    slug: "flash-editorial-test",
    title: "Flash editorial test",
    subtitle: "Dos preguntas",
    description: "Preview protegido",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: [
    {
      slug: "editorial-one",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Test",
        tags: {},
        question: "Pregunta uno",
        options: ["A", "B"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: { correctAnswer: "A", explanation: "A es correcta." },
    },
    {
      slug: "editorial-two",
      type: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 15000,
      points: 50,
      publicPayload: {
        category: "Test",
        tags: {},
        question: "Pregunta dos",
        options: ["C", "D"],
        media: null,
        promptVisual: null,
      },
      solutionPayload: { correctAnswer: "C", explanation: "C es correcta." },
    },
  ],
};

function entry(status: "draft" | "published", id: string) {
  return {
    challengeDefinitionId: `00000000-0000-4000-8000-00000000000${id}`,
    challengeVersionId: `00000000-0000-4000-8000-00000000001${id}`,
    versionNumber: 1,
    status,
    slug: document.challenge.slug,
    title: document.challenge.title,
    subtitle: document.challenge.subtitle,
    description: document.challenge.description,
    mode: "flash" as const,
    questionCount: 2,
    createdAt: "2026-09-16T10:00:00.000Z",
    updatedAt: "2026-09-16T10:00:00.000Z",
    publishedAt: status === "published" ? "2026-09-16T10:05:00.000Z" : null,
    document: status === "draft" ? document : null,
  };
}

describe("EditorialManagement", () => {
  it("shows the immutable difficulty of an archived library reference", () => {
    const referenced = "00000000-0000-4000-8000-000000000099";
    const draft = entry("draft", "1");
    const markup = renderToStaticMarkup(
      <EditorialManagement
        context={{
          source: "supabase",
          entries: [
            {
              ...draft,
              document: {
                ...document,
                questions: [
                  { source: "library", questionVersionId: referenced, points: 50, modeConfig: {} },
                  document.questions[1]!,
                ],
              },
            },
          ],
        }}
        questionLibrary={{
          source: "supabase",
          total: 1,
          page: 1,
          pageSize: 50,
          entries: [
            {
              questionVersionId: referenced,
              questionDefinitionId: "definition",
              versionNumber: 1,
              status: "archived",
              slug: "referenced",
              type: "multiple-choice",
              question: "Pregunta archivada",
              category: null,
              tags: {},
              timeLimitMs: 15000,
              difficulty: "hard",
              createdAt: "2026-10-20",
              updatedAt: "2026-10-20",
              publishedAt: "2026-10-20",
              versionCount: 1,
              usageCount: 1,
            },
          ],
        }}
      />,
    );
    const select = markup.match(/<select[^>]*id="[^"]*difficulty-0"[^>]*>[\s\S]*?<\/select>/)?.[0];
    expect(select).toContain('disabled=""');
    expect(select).toContain('<option value="hard" selected="">Difícil</option>');
  });
  it("shows independent Pyramid credit controls with the configured formats selected", () => {
    const formats = [
      "connect-pairs",
      "word-search",
      "queens",
      "matching",
      "classification",
      "ordering",
    ] as const;
    const questionLibrary = {
      source: "supabase" as const,
      total: formats.length,
      page: 1,
      pageSize: 50,
      entries: formats.map((type, index) => ({
        questionVersionId: `00000000-0000-4000-8000-00000000009${index}`,
        questionDefinitionId: `definition-${index}`,
        versionNumber: 1,
        status: "published" as const,
        slug: type,
        type,
        question: type,
        category: null,
        tags: {},
        timeLimitMs: 15000,
        createdAt: "2026-10-20",
        updatedAt: "2026-10-20",
        publishedAt: "2026-10-20",
        versionCount: 1,
        usageCount: 1,
      })),
    };
    const draft: FlashEditorialDocument = {
      challenge: {
        ...document.challenge,
        mode: "pyramid",
        modeConfig: {
          connectPairsTimeoutPartialCredit: true,
          queensTimeoutPartialCredit: true,
          matchingPartialCredit: true,
          orderingPartialCredit: true,
        },
      },
      questions: Array.from({ length: 7 }, (_, index) => {
        const modeConfig = {
          levelId: `level-${index}`,
          label: `Nivel ${index + 1}`,
          briefing: { title: "Prueba", format: "Formato", description: "Sube un nivel." },
        };
        const question = questionLibrary.entries[index];
        return question
          ? {
              source: "library" as const,
              questionVersionId: question.questionVersionId,
              points: 10,
              modeConfig,
            }
          : {
              ...document.questions[0]!,
              slug: `inline-${index}`,
              points: index === 6 ? 40 : 10,
              modeConfig,
            };
      }),
    };
    const markup = renderToStaticMarkup(
      <EditorialManagement
        context={{
          source: "supabase",
          entries: [{ ...entry("draft", "1"), mode: "pyramid", document: draft }],
        }}
        questionLibrary={questionLibrary}
      />,
    );
    for (const [label, enabled, suffix] of [
      ["Conectar parejas", true, "al agotar el tiempo"],
      ["Sopa de letras", false, "al agotar el tiempo"],
      ["Queens", true, "al agotar el tiempo"],
      ["Emparejamiento", true, "al confirmar o agotar el tiempo"],
      ["Clasificación", false, "al confirmar o agotar el tiempo"],
      ["Ordenación", true, "al confirmar o agotar el tiempo"],
    ] as const) {
      const input = markup.match(
        new RegExp(`(<input[^>]*>) Puntos parciales en ${label} ${suffix}`),
      )?.[1];
      expect(input).toContain('type="checkbox"');
      expect(input?.includes('checked=""')).toBe(enabled);
    }
  });

  it("renders protected preview and publishing controls only for a draft", () => {
    const context: SuperadminEditorialContext = {
      entries: [entry("draft", "1"), entry("published", "2")],
      source: "supabase",
    };
    const markup = renderToStaticMarkup(<EditorialManagement context={context} />);

    expect(markup).toContain("Previsualización editorial protegida");
    expect(markup).toContain("Solución privada: <strong>A</strong>");
    expect(markup).toContain("Publicar versión");
    expect(markup).toContain("Publicado");
    expect(markup).not.toContain("start_attempt");
    expect(markup).not.toContain("prepare_interaction");
  });

  it("does not render publish controls when the catalog has no drafts", () => {
    const context: SuperadminEditorialContext = {
      entries: [entry("published", "2")],
      source: "supabase",
    };
    const markup = renderToStaticMarkup(<EditorialManagement context={context} />);

    expect(markup).toContain("Versiones no editables");
    expect(markup).not.toContain("Publicar versión");
    expect(markup).toContain("Solución privada:");
  });

  it("keeps a published-only challenge in read-only detail mode", () => {
    const context: SuperadminEditorialContext = {
      entries: [entry("published", "2")],
      source: "supabase",
    };
    const markup = renderToStaticMarkup(
      <EditorialManagement
        context={context}
        canCreate={false}
        allowNewDraft={false}
        title="Flash beta"
      />,
    );

    expect(markup).toContain("Flash beta");
    expect(markup).toContain("Versiones no editables");
    expect(markup).not.toContain("Documento editorial");
    expect(markup).not.toContain("Guardar borrador");
  });
});
