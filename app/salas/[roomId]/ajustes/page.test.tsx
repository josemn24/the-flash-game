import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomSettings } from "@/components/game/modes/flash-pop/FlashPopRoomSettings";
import { mockQueryContext, mockRoomQueries } from "@/test-utils/mockRoom";
import { dynamic, generateMetadata } from "./page";

describe("room settings route", () => {
  it("exposes Tabarnia and its settings view", async () => {
    expect(dynamic).toBe("force-dynamic");
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Ajustes de Tabarnia — Flash Pop",
    });

    const model = await mockRoomQueries.getSettings("tabarnia-room", mockQueryContext());
    if (!model) throw new Error("Expected settings model");
    const markup = renderToStaticMarkup(<FlashPopRoomSettings model={model} />);

    expect(markup).toContain("Acciones");
    expect(markup).toContain("Tabarnia");
    expect(markup).toContain('href="/salas/tabarnia-room"');
  });
});
