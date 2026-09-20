import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SuperadminAccessDeniedError,
  SuperadminEditorialCommandError,
} from "@/application/administration/errors";
import { SupabaseSuperadminEditorialQueries } from "./superadminEditorialQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const document = {
  challenge: {
    slug: "flash-editorial",
    title: "Flash editorial",
    subtitle: "Dos preguntas",
    description: "Prueba",
    mode: "flash" as const,
    configSchemaVersion: 1 as const,
    modeConfig: {},
  },
  questions: [1, 2].map((index) => ({
    slug: `question-${index}`,
    type: "multiple-choice" as const,
    payloadSchemaVersion: 1 as const,
    timeLimitMs: 15000,
    points: 50 as const,
    publicPayload: {
      category: "Test",
      tags: {},
      question: `Question ${index}`,
      options: ["A", "B"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: { correctAnswer: "A", explanation: "A" },
  })) as unknown as readonly [never, never],
};

const entry = {
  challengeDefinitionId: "00000000-0000-4000-8000-000000000001",
  challengeVersionId: "00000000-0000-4000-8000-000000000002",
  versionNumber: 1,
  status: "draft" as const,
  slug: "flash-editorial",
  title: "Flash editorial",
  subtitle: "Dos preguntas",
  description: "Prueba",
  mode: "flash" as const,
  questionCount: 2,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  publishedAt: null,
  document,
};

const summary = {
  challengeDefinitionId: entry.challengeDefinitionId,
  slug: entry.slug,
  title: entry.title,
  subtitle: entry.subtitle,
  description: entry.description,
  mode: "flash" as const,
  questionCount: 2,
  versionCount: 2,
  status: "draft" as const,
  statusCounts: { draft: 1, published: 1, archived: 0 },
  updatedAt: entry.updatedAt,
  latestVersion: {
    challengeVersionId: entry.challengeVersionId,
    versionNumber: entry.versionNumber,
    status: entry.status,
    questionCount: 2,
    updatedAt: entry.updatedAt,
    publishedAt: null,
  },
};

const questionVersionId = "00000000-0000-4000-8000-000000000010";
const questionDefinitionId = "00000000-0000-4000-8000-000000000011";
const questionDocument = {
  slug: "question-library",
  type: "multiple-choice" as const,
  payloadSchemaVersion: 1 as const,
  timeLimitMs: 15000,
  publicPayload: { category: "Test", tags: {}, question: "Question", options: ["A", "B"], media: null, promptVisual: null },
  solutionPayload: { correctAnswer: "A", explanation: "A" },
};
const libraryEntry = {
  questionDefinitionId,
  questionVersionId,
  versionNumber: 1,
  status: "published" as const,
  slug: "question-library",
  type: "multiple-choice" as const,
  question: "Question",
  category: "Test",
  tags: {},
  timeLimitMs: 15000,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  publishedAt: "2026-09-16T10:00:00.000Z",
  versionCount: 1,
  usageCount: 2,
};

describe("SupabaseSuperadminEditorialQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("reads and validates the protected editorial context", async () => {
    mocks.rpc.mockResolvedValue({ data: { entries: [entry] }, error: null });

    await expect(new SupabaseSuperadminEditorialQueries().getContext()).resolves.toEqual({
      entries: [entry],
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_superadmin_editorial_context");
  });

  it("reads the challenge catalog without requiring editorial documents", async () => {
    mocks.rpc.mockResolvedValue({ data: { entries: [summary] }, error: null });

    await expect(new SupabaseSuperadminEditorialQueries().getChallengeCatalog()).resolves.toEqual({
      entries: [summary],
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_superadmin_challenge_catalog");
  });

  it("reads one challenge detail and returns null for an invalid or missing definition", async () => {
    const queries = new SupabaseSuperadminEditorialQueries();
    mocks.rpc.mockResolvedValue({ data: { challengeDefinitionId: entry.challengeDefinitionId, entries: [entry] }, error: null });

    await expect(queries.getChallengeDetail(entry.challengeDefinitionId)).resolves.toEqual({
      challengeDefinitionId: entry.challengeDefinitionId,
      entries: [entry],
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_superadmin_challenge_detail", {
      target_challenge_definition_id: entry.challengeDefinitionId,
    });

    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(queries.getChallengeDetail(entry.challengeDefinitionId)).resolves.toBeNull();
    await expect(queries.getChallengeDetail("not-a-uuid")).resolves.toBeNull();
  });

  it("calls each narrow RPC and marks command results as Supabase sourced", async () => {
    mocks.rpc.mockResolvedValue({ data: entry, error: null });
    const queries = new SupabaseSuperadminEditorialQueries();
    const input = { idempotencyKey: "editorial-test-1", document, reason: "Test" };

    await expect(queries.createFlashDraft(input)).resolves.toMatchObject({ source: "supabase" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("create_superadmin_flash_draft", { input });

    const updateInput = {
      idempotencyKey: "editorial-test-2",
      challengeVersionId: entry.challengeVersionId,
      expectedUpdatedAt: entry.updatedAt,
      document,
      reason: "Test update",
    };
    await expect(queries.updateFlashDraft(updateInput)).resolves.toMatchObject({ source: "supabase" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("update_superadmin_flash_draft", { input: updateInput });

    const publishInput = {
      idempotencyKey: "editorial-test-3",
      challengeVersionId: entry.challengeVersionId,
      expectedUpdatedAt: entry.updatedAt,
      reason: "Test publish",
    };
    await expect(queries.publishFlash(publishInput)).resolves.toMatchObject({ source: "supabase" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("publish_superadmin_flash", { input: publishInput });

    mocks.rpc.mockResolvedValue({ data: { ...entry, document: null }, error: null });
    await expect(queries.createFlashDraft(input)).resolves.toMatchObject({
      status: "draft",
      document: null,
      source: "supabase",
    });
  });

  it("reads the library and routes version commands through dedicated RPCs", async () => {
    const detail = { questionDefinitionId, slug: "question-library", versions: [{ ...libraryEntry, document: questionDocument }] };
    mocks.rpc.mockResolvedValue({ data: { entries: [libraryEntry], total: 1, page: 1, pageSize: 25 }, error: null });
    const queries = new SupabaseSuperadminEditorialQueries();
    await expect(queries.getQuestionLibrary({ status: "all" })).resolves.toMatchObject({ total: 1, source: "supabase" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("get_superadmin_question_library", { input: { status: "all" } });

    mocks.rpc.mockResolvedValue({ data: detail, error: null });
    await expect(queries.getQuestionVersion(questionVersionId)).resolves.toMatchObject({ slug: "question-library", source: "supabase" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("get_superadmin_question_version", { question_version_id: questionVersionId });

    const input = { idempotencyKey: "question-test-1", document: questionDocument, reason: "Test" };
    await expect(queries.createQuestionDraft(input)).resolves.toMatchObject({ source: "supabase" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("create_superadmin_question_draft", { input });
  });

  it("rejects malformed Supabase payloads instead of falling back", async () => {
    mocks.rpc.mockResolvedValue({ data: { entries: [{ ...entry, document: null }] }, error: null });

    await expect(new SupabaseSuperadminEditorialQueries().getContext()).rejects.toThrow(
      "invalid context payload",
    );
  });

  it("maps authorization and domain errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not_authorized" } });
    await expect(new SupabaseSuperadminEditorialQueries().publishFlash({
      idempotencyKey: "editorial-test-4",
      challengeVersionId: entry.challengeVersionId,
      expectedUpdatedAt: entry.updatedAt,
      reason: "Test",
    })).rejects.toBeInstanceOf(SuperadminAccessDeniedError);

    mocks.rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "content_not_draft" } });
    await expect(new SupabaseSuperadminEditorialQueries().publishFlash({
      idempotencyKey: "editorial-test-5",
      challengeVersionId: entry.challengeVersionId,
      expectedUpdatedAt: entry.updatedAt,
      reason: "Test",
    })).rejects.toMatchObject({
      code: "content_not_draft",
      name: "SuperadminEditorialCommandError",
    } satisfies Partial<SuperadminEditorialCommandError>);
  });
});
