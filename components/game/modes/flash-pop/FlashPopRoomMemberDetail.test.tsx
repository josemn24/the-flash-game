import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolvePlayerRouteKey, resolveScheduledChallengeRouteKey } from "@/data/mock/selectors";
import { mockDomainStore } from "@/data/mock/store";
import { createMockRoomReadCapabilities, mockQueryContext } from "@/test-utils/mockRoom";
import { FlashPopRoomMemberDetail } from "./FlashPopRoomMemberDetail.client";

const now = new Date("2026-09-01T12:00:00.000Z");
const roomReadCapabilities = createMockRoomReadCapabilities({
  ...mockDomainStore,
  scheduledChallenges: mockDomainStore.scheduledChallenges.map((schedule) =>
    schedule.number === 1 ? { ...schedule, status: "open", resultsLockedAt: null } : schedule,
  ),
});

describe("FlashPopRoomMemberDetail", () => {
  it("renders the attempt summary and expandable answer history", async () => {
    const model = await roomReadCapabilities.getMemberDetail(
      "tabarnia-room",
      "ches",
      mockQueryContext(now, resolvePlayerRouteKey("ches")!),
    );
    if (!model) throw new Error("Expected member model");

    const markup = renderToStaticMarkup(<FlashPopRoomMemberDetail model={model} />);

    expect(markup).toContain("Dark");
    expect(markup).toContain("242 ⚡");
    expect(markup).toContain("242 Flash Points");
    expect(markup).toContain("#1 en la sala");
    expect(markup).toContain("54");
    expect(markup).toContain("Flash Points");
    expect(markup).toContain("Puntos del reto");
    expect(markup).toContain("ranking del reto");
    expect(markup).not.toContain("Completado");
    expect(markup).toContain("Respuestas");
    expect(markup).not.toContain("Desglose completo");
    expect(markup).toContain("Respuesta correcta");
    expect(markup).toContain("4/4 parejas correctas");
    expect(markup).toContain("details");
    expect(markup).toContain('href="/salas/tabarnia-room/ranking"');
    expect(markup).not.toContain("gemas");
  });

  it("renders a clear empty state for pending players", async () => {
    const model = await roomReadCapabilities.getMemberDetail(
      "tabarnia-room",
      "laura",
      mockQueryContext(now),
    );
    if (!model) throw new Error("Expected member model");

    const markup = renderToStaticMarkup(<FlashPopRoomMemberDetail model={model} />);

    expect(markup).toContain("Palmera");
    expect(markup).not.toContain("Pendiente");
    expect(markup).toContain("Todavía no ha jugado");
    expect(markup).not.toContain("Historial de respuestas");
  });

  it.each(["completed", "abandoned"] as const)(
    "renders every Alphabet letter for a %s attempt",
    async (status) => {
      const scheduleId = resolveScheduledChallengeRouteKey("tabarnia-challenge-02")!;
      const attempt = mockDomainStore.attempts.find(
        (candidate) =>
          candidate.scheduledChallengeId === scheduleId &&
          candidate.playerId === resolvePlayerRouteKey("ches"),
      )!;
      const reads = createMockRoomReadCapabilities({
        ...mockDomainStore,
        attempts: mockDomainStore.attempts.map((candidate) =>
          candidate.id === attempt.id ? { ...candidate, status } : candidate,
        ),
        attemptAnswers: mockDomainStore.attemptAnswers.filter(
          (answer) => answer.attemptId !== attempt.id,
        ),
      });
      const model = await reads.getMemberDetail(
        "tabarnia-room",
        "ches",
        mockQueryContext(new Date("2026-09-12T12:00:00Z")),
        "tabarnia-challenge-02",
      );
      if (!model || model.reviewProgress?.mode !== "alphabet")
        throw new Error("Expected Alphabet review");
      const markup = renderToStaticMarkup(<FlashPopRoomMemberDetail model={model} />);
      expect(markup).toContain("Alfabeto");
      expect(markup).toContain(`0 de ${model.reviewItems.length} letras acertadas`);
      expect(markup.match(/Sin responder/g)).toHaveLength(model.reviewItems.length);
      expect(markup).toContain("Respuesta correcta");
      for (const item of model.reviewItems)
        expect(markup).toContain(`>${item.metadata?.alphabetLetter}</`);
      expect(markup.includes("Partida abandonada")).toBe(status === "abandoned");
    },
  );
});
