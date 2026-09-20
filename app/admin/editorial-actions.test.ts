import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminEditorialCommandError } from "@/application/administration/errors";

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  publish: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/server/admin", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/server/admin-editorial", () => ({
  createSuperadminFlashDraft: mocks.createDraft,
  updateSuperadminFlashDraft: mocks.updateDraft,
  publishSuperadminFlash: mocks.publish,
}));

import { createFlashDraft, publishFlash, updateFlashDraft } from "./editorial-actions";

const document = {
  challenge: {
    slug: "flash-editorial",
    title: "Flash editorial",
    subtitle: "Dos preguntas",
    description: "Prueba",
    mode: "flash",
    configSchemaVersion: 1,
    modeConfig: {},
  },
  questions: [1, 2].map((index) => ({
    slug: `question-${index}`,
    type: "multiple-choice",
    payloadSchemaVersion: 1,
    timeLimitMs: 15000,
    points: 50,
    publicPayload: {
      category: "Test",
      tags: {},
      question: `Question ${index}`,
      options: ["A", "B"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: { correctAnswer: "A", explanation: "A" },
  })),
};

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.append(key, value);
  return form;
}

describe("editorial admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperadmin.mockResolvedValue({});
    mocks.createDraft.mockResolvedValue({});
    mocks.updateDraft.mockResolvedValue({});
    mocks.publish.mockResolvedValue({});
  });

  it("authorizes and sends a parsed document when creating a draft", async () => {
    await expect(createFlashDraft({}, formData({
      idempotencyKey: "editorial-create-1",
      document: JSON.stringify(document),
      reason: "Preparar contenido",
    }))).rejects.toThrow("REDIRECT:/admin/content?editorial=saved");

    expect(mocks.requireSuperadmin).toHaveBeenCalledTimes(1);
    expect(mocks.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "editorial-create-1",
      reason: "Preparar contenido",
      document: expect.objectContaining({ challenge: expect.objectContaining({ mode: "flash" }) }),
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/content");
  });

  it("rejects malformed JSON before crossing the command boundary", async () => {
    const result = await createFlashDraft({}, formData({
      idempotencyKey: "editorial-create-2",
      document: "{",
      reason: "Preparar contenido",
    }));

    expect(result.fieldErrors?.document).toContain("JSON válido");
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });

  it("passes the optimistic timestamp when updating", async () => {
    await expect(updateFlashDraft({}, formData({
      idempotencyKey: "editorial-update-1",
      challengeVersionId: "00000000-0000-4000-8000-000000000001",
      expectedUpdatedAt: "2026-09-16T10:00:00.000Z",
      document: JSON.stringify(document),
      reason: "Editar contenido",
    }))).rejects.toThrow("REDIRECT:/admin/content?editorial=saved");

    expect(mocks.requireSuperadmin).toHaveBeenCalledTimes(1);
    expect(mocks.updateDraft).toHaveBeenCalledWith(expect.objectContaining({
      challengeVersionId: "00000000-0000-4000-8000-000000000001",
      expectedUpdatedAt: "2026-09-16T10:00:00.000Z",
    }));
  });

  it("maps publication conflicts to a safe form error", async () => {
    mocks.publish.mockRejectedValue(new SuperadminEditorialCommandError("content_conflict"));
    const result = await publishFlash({}, formData({
      idempotencyKey: "editorial-publish-1",
      challengeVersionId: "00000000-0000-4000-8000-000000000001",
      expectedUpdatedAt: "2026-09-16T10:00:00.000Z",
      reason: "Publicar contenido",
    }));

    expect(result.fieldErrors?.form).toContain("otra pestaña");
  });
});
