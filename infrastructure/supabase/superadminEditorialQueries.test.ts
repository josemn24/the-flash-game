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
