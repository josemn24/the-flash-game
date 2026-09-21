import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomSettingsModel } from "@/lib/roomSettings";
import { FlashPopRoomSettings } from "./FlashPopRoomSettings";

describe("FlashPopRoomSettings", () => {
  it("renders the room identity, disabled actions and members", () => {
    const markup = renderToStaticMarkup(
      <FlashPopRoomSettings model={buildRoomSettingsModel(demoRoom)} />,
    );

    expect(markup).toContain("Tabarnia");
    expect(markup).toContain("5 miembros");
    expect(markup).toContain("Miembros");
    expect(markup).toContain("Dark");
    expect(markup).toContain("136 Flash Points");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).toContain('aria-label="Invitar a la sala, próximamente"');
    expect(markup).toContain('aria-label="Editar perfil, próximamente"');
    expect(markup).toContain('aria-label="Notificaciones, próximamente"');
    expect(markup.match(/disabled=""/g)).toHaveLength(3);
    expect(markup).not.toContain("Ranking global");
    expect(markup).not.toContain("Historial");
    expect(markup).not.toContain("Reto de hoy");
  });
});
