import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomSettings } from "@/components/game/modes/flash-pop/FlashPopRoomSettings";
import { mockQueryContext, mockRoomQueries } from "@/test-utils/mockRoom";
import RoomSettingsPage, { dynamic, generateMetadata } from "./page";

describe("room settings route", () => {
  it("exposes Tabarnia and its settings view", async () => {
    expect(dynamic).toBe("force-dynamic");
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Ajustes de Tabarnia — The Flash",
    });

    const model = await mockRoomQueries.getSettings("tabarnia-room", mockQueryContext());
    if (!model) throw new Error("Expected settings model");
    const markup = renderToStaticMarkup(<FlashPopRoomSettings model={model} />);

    expect(markup).toContain("Tabarnia");
    expect(markup).not.toContain('aria-labelledby="room-actions-title"');
    expect(markup).toContain('href="/salas/tabarnia-room"');
  });

  it("renders the full route through the data-access boundary", async () => {
    const element = await RoomSettingsPage({
      params: Promise.resolve({ roomId: "tabarnia-room" }),
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Tabarnia");
    expect(markup).toContain("Miembros");
    expect(markup).toContain("Flash Points");
  });
});
