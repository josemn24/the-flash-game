import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomMemberDetailModel } from "@/lib/roomMemberDetail";
import { FlashPopRoomMemberDetail } from "./FlashPopRoomMemberDetail.client";

const now = new Date("2026-09-08T12:00:00.000Z");

describe("FlashPopRoomMemberDetail", () => {
  it("renders the attempt summary and expandable answer history", () => {
    const model = buildRoomMemberDetailModel(demoRoom, "ches", now);
    if (!model) throw new Error("Expected member model");

    const markup = renderToStaticMarkup(<FlashPopRoomMemberDetail model={model} />);

    expect(markup).toContain("Dark");
    expect(markup).toContain("54");
    expect(markup).toContain("Flash points");
    expect(markup).toContain("Completado");
    expect(markup).toContain("Historial de respuestas");
    expect(markup).toContain("Respuesta correcta");
    expect(markup).toContain("4/4 parejas correctas");
    expect(markup).toContain("details");
    expect(markup).toContain('href="/salas/tabarnia-room/ranking"');
    expect(markup).not.toContain("gemas");
  });

  it("renders a clear empty state for pending players", () => {
    const model = buildRoomMemberDetailModel(demoRoom, "laura", now);
    if (!model) throw new Error("Expected member model");

    const markup = renderToStaticMarkup(<FlashPopRoomMemberDetail model={model} />);

    expect(markup).toContain("Palmera");
    expect(markup).toContain("Pendiente");
    expect(markup).toContain("Todavía no ha jugado");
    expect(markup).not.toContain("Historial de respuestas");
  });
});
