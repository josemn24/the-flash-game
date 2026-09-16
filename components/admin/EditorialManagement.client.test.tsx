import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FlashEditorialDocument, SuperadminEditorialContext } from "@/types/view-models/editorial";
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
});
