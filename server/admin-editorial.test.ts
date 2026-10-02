import { beforeEach, describe, expect, it, vi } from "vitest";

const consumeAdminRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/server/competitive/rate-limit", () => ({ consumeAdminRateLimit }));

import { publishSuperadminFlash } from "./admin-editorial";

const input = {
  idempotencyKey: "publish-capability-test",
  challengeVersionId: "00000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-10-01T10:00:00.000Z",
  reason: "Comprobar capacidades",
};

function draftDocument(type: string) {
  return {
    challenge: {
      slug: "capability-test",
      title: "Capability test",
      subtitle: "",
      description: "",
      mode: "survival",
      configSchemaVersion: 1,
      modeConfig: { lives: 1 },
    },
    questions: [{ type, payloadSchemaVersion: 1 }],
  };
}

describe("publishSuperadminFlash", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs the capability preflight before publishing", async () => {
    const publish = vi.fn();
    const commands = { publishFlash: publish } as never;
    const queries = {
      getContext: vi.fn().mockResolvedValue({
        source: "supabase",
        entries: [
          {
            challengeVersionId: input.challengeVersionId,
            document: draftDocument("short-text"),
          },
        ],
      }),
    };

    await expect(publishSuperadminFlash(input, commands, queries)).rejects.toEqual(
      expect.objectContaining({ code: "unsupported_question_type" }),
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("delegates when the manifest accepts the draft", async () => {
    const result = { challengeVersionId: input.challengeVersionId };
    const publish = vi.fn().mockResolvedValue(result);
    const commands = { publishFlash: publish } as never;
    const queries = {
      getContext: vi.fn().mockResolvedValue({
        source: "supabase",
        entries: [
          {
            challengeVersionId: input.challengeVersionId,
            document: draftDocument("multiple-choice"),
          },
        ],
      }),
    };

    await expect(publishSuperadminFlash(input, commands, queries)).resolves.toBe(result);
    expect(publish).toHaveBeenCalledWith(input);
  });
});
