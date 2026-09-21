import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockQueryContext, mockRoomQueries } from "@/test-utils/mockRoom";
import { FlashPopRoomSettings } from "./FlashPopRoomSettings";

describe("FlashPopRoomSettings", () => {
  it("renders the room identity and members without the deferred actions section", async () => {
    const model = await mockRoomQueries.getSettings("tabarnia-room", mockQueryContext());
    if (!model) throw new Error("Expected room settings model");

    const markup = renderToStaticMarkup(<FlashPopRoomSettings model={model} />);

    expect(markup).toContain("Tabarnia");
    expect(markup).toContain("5 miembros");
    expect(markup).toContain("Miembros");
    expect(markup).toContain("Dark");
    expect(markup).toContain("169 Flash Points");
    expect(markup).toContain("Propietario");
    expect(markup).toContain("Admin");
    expect(markup).toContain("Tú");
    expect(markup).toContain('aria-label="Acciones para Dark"');
    expect(markup).not.toContain("memberRank");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).toContain('aria-label="Invitar a la sala, próximamente"');
    expect(markup).not.toContain('aria-labelledby="room-actions-title"');
    expect(markup).not.toContain("Editar perfil");
    expect(markup).not.toContain("Notificaciones");
    expect(markup.match(/disabled=""/g)).toHaveLength(1);
    expect(markup).not.toContain("Ranking global");
    expect(markup).not.toContain("Historial");
    expect(markup).not.toContain("Reto de hoy");

    const memberMarkup = renderToStaticMarkup(
      <FlashPopRoomSettings
        model={{
          ...model,
          canManageMembers: false,
          members: model.members.map((member) => ({ ...member, canManage: false })),
        }}
      />,
    );
    expect(memberMarkup).not.toContain('aria-label="Acciones para Dark"');
  });
});
