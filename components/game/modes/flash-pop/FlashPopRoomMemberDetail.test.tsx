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
    expect(markup).toContain("184 Flash points");
    expect(markup).toContain("#1 en la sala");
    expect(markup).toContain("54");
    expect(markup).toContain("Flash points");
    expect(markup).toContain("puntos del reto");
    expect(markup).toContain("ranking de hoy");
    expect(markup).not.toContain("Completado");
    expect(markup).toContain("Respuestas");
    expect(markup).not.toContain("Desglose completo");
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
    expect(markup).not.toContain("Pendiente");
    expect(markup).toContain("Todavía no ha jugado");
    expect(markup).not.toContain("Historial de respuestas");
  });
});
