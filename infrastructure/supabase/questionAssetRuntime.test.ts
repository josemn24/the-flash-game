import { beforeEach, describe, expect, it, vi } from "vitest";

import { readCompetitiveQuestionAsset } from "@/infrastructure/supabase/mediaAssetCommands";
import { supabaseMediaStorage } from "@/infrastructure/supabase/mediaStorage";
import { resolveCompetitiveQuestionPayload } from "./questionAssetRuntime";

vi.mock("@/infrastructure/supabase/mediaAssetCommands", () => ({
  readCompetitiveQuestionAsset: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/mediaStorage", () => ({
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
});
