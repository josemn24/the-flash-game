import { beforeEach, describe, expect, it, vi } from "vitest";

import { readCompetitiveQuestionAsset } from "@/infrastructure/supabase/assets/mediaAssetCommands";
import { supabaseMediaStorage } from "@/infrastructure/supabase/assets/mediaStorage";
import { resolveCompetitiveQuestionPayload } from "./questionAssetRuntime";

vi.mock("@/infrastructure/supabase/assets/mediaAssetCommands", () => ({
  readCompetitiveQuestionAsset: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/assets/mediaStorage", () => ({
  supabaseMediaStorage: { createSignedReadUrl: vi.fn() },
}));

describe("resolveCompetitiveQuestionPayload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves a multiple-choice media asset into a signed runtime source", async () => {
    vi.mocked(readCompetitiveQuestionAsset).mockResolvedValue({
      assetId: "asset-1",
      objectPath: "question-assets/asset-1.png",
      status: "ready",
    });
    vi.mocked(supabaseMediaStorage.createSignedReadUrl).mockResolvedValue({
      signedUrl: "https://signed.example/question.png?token=test",
      expiresAt: "2026-09-19T12:05:00.000Z",
    });

    const resolved = await resolveCompetitiveQuestionPayload({
      authUserId: "player-1",
      attemptId: "attempt-1",
      publicPayload: {
        question: "¿Qué aparece?",
        media: {
          type: "image",
          assetId: "asset-1",
          alt: "Imagen",
          width: 1200,
          height: 800,
          fit: "contain",
        },
      },
    });

    expect(readCompetitiveQuestionAsset).toHaveBeenCalledWith("player-1", {
      attemptId: "attempt-1",
      assetId: "asset-1",
    });
    expect(resolved).toEqual({
      question: "¿Qué aparece?",
      media: {
        type: "image",
        src: "https://signed.example/question.png?token=test",
        alt: "Imagen",
        width: 1200,
        height: 800,
        fit: "contain",
      },
    });
  });

  it("resolves a progressive-image surface asset into a signed runtime source", async () => {
    vi.mocked(readCompetitiveQuestionAsset).mockResolvedValue({
      assetId: "asset-progressive",
      objectPath: "question-assets/asset-progressive.png",
      status: "ready",
    });
    vi.mocked(supabaseMediaStorage.createSignedReadUrl).mockResolvedValue({
      signedUrl: "https://signed.example/progressive.png?token=test",
      expiresAt: "2026-09-19T12:05:00.000Z",
    });

    const resolved = await resolveCompetitiveQuestionPayload({
      authUserId: "player-1",
      attemptId: "peer-attempt-1",
      publicPayload: {
        question: "¿Qué aparece?",
        surface: {
          assetId: "asset-progressive",
          alt: "Imagen progresiva",
          width: 1024,
          height: 1024,
          fit: "contain",
        },
        revealDurationMs: 7000,
      },
    });

    expect(readCompetitiveQuestionAsset).toHaveBeenCalledWith("player-1", {
      attemptId: "peer-attempt-1",
      assetId: "asset-progressive",
    });
    expect(resolved).toEqual({
      question: "¿Qué aparece?",
      surface: {
        src: "https://signed.example/progressive.png?token=test",
        alt: "Imagen progresiva",
        width: 1024,
        height: 1024,
        fit: "contain",
      },
      revealDurationMs: 7000,
    });
  });
});
