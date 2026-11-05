// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SuperadminQuestionVersionDetail } from "@/types/view-models/editorial";
import { QuestionVersionEditor } from "./QuestionVersionEditor.client";

vi.mock("@/app/admin/question-actions", () => ({
  createQuestionDraft: vi.fn(),
  updateQuestionDraft: vi.fn(),
  publishQuestion: vi.fn(),
  archiveQuestion: vi.fn(),
}));
vi.mock("./editorial/QuestionAssetUploader.client", () => ({ QuestionAssetUploader: () => null }));
afterEach(cleanup);
const detail: SuperadminQuestionVersionDetail = {
  source: "supabase",
  questionDefinitionId: "definition",
  slug: "hexagono",
  versions: [
    {
      questionDefinitionId: "definition",
      questionVersionId: "version",
      versionNumber: 1,
      status: "published",
      slug: "hexagono",
      type: "true-false",
      question: "Un hexágono tiene seis lados.",
      category: null,
      tags: {},
      timeLimitMs: 15000,
      difficulty: "hard",
      createdAt: "2026-10-20",
      updatedAt: "2026-10-20",
      publishedAt: "2026-10-20",
      versionCount: 1,
      usageCount: 0,
      document: {
        slug: "hexagono",
        type: "true-false",
        payloadSchemaVersion: 1,
        timeLimitMs: 15000,
        difficulty: "hard",
        publicPayload: { question: "Un hexágono tiene seis lados." },
        solutionPayload: { correctAnswer: true, explanation: "Tiene seis lados." },
      },
    },
  ],
};
it("prepares a new version with the published content and difficulty intact", () => {
  render(<QuestionVersionEditor detail={detail} />);
  const editor = screen.getByLabelText("Documento standalone (sin points)") as HTMLTextAreaElement;
  expect(JSON.parse(editor.value)).toMatchObject(detail.versions[0]!.document!);
  expect((screen.getByLabelText("Dificultad") as HTMLSelectElement).value).toBe("hard");
  expect(screen.getByRole("button", { name: "Crear nueva versión" })).toBeTruthy();
  expect(screen.getByText("Dificultad: Difícil")).toBeTruthy();
});
it("changes only the draft metadata and leaves the published version intact", () => {
  const before = JSON.stringify(detail);
  render(<QuestionVersionEditor detail={detail} />);
  fireEvent.change(screen.getByLabelText("Dificultad"), { target: { value: "easy" } });
  const editor = screen.getByLabelText("Documento standalone (sin points)") as HTMLTextAreaElement;
  expect(JSON.parse(editor.value)).toEqual({ ...detail.versions[0]!.document, difficulty: "easy" });
  expect(screen.getByText("Dificultad: Difícil")).toBeTruthy();
  expect(JSON.stringify(detail)).toBe(before);
});
