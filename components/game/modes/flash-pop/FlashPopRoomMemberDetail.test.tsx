import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockDomainStore } from "@/data/mock/store";
import { createMockRoomQueries, mockQueryContext } from "@/test-utils/mockRoom";
import { FlashPopRoomMemberDetail } from "./FlashPopRoomMemberDetail.client";

const now = new Date("2026-09-01T12:00:00.000Z");
const roomQueries = createMockRoomQueries({
  ...mockDomainStore,
  scheduledChallenges: mockDomainStore.scheduledChallenges.map((schedule) =>
    schedule.number === 1 ? { ...schedule, status: "open", resultsLockedAt: null } : schedule,
  ),
});

describe("FlashPopRoomMemberDetail", () => {
  it("renders the attempt summary and expandable answer history", async () => {
    const model = await roomQueries.getMemberDetail("tabarnia-room", "ches", mockQueryContext(now));
    if (!model) throw new Error("Expected member model");

    const markup = renderToStaticMarkup(<FlashPopRoomMemberDetail model={model} />);

    expect(markup).toContain("Dark");
    expect(markup).toContain("242 ⚡");
    expect(markup).toContain("242 Flash Points");
    expect(markup).toContain("#1 en la sala");
    expect(markup).toContain("54");
    expect(markup).toContain("Flash Points");
    expect(markup).toContain("Flash Points del reto");
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
    const model = await roomQueries.getMemberDetail(
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
});
