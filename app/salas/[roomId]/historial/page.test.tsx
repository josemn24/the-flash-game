import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomHistory } from "@/components/game/modes/flash-pop/FlashPopRoomHistory";
import { mockQueryContext, mockRoomQueries } from "@/test-utils/mockRoom";
import { dynamic, generateMetadata } from "./page";

describe("room history route", () => {
  it("exposes Tabarnia and renders previous games", async () => {
    expect(dynamic).toBe("force-dynamic");
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Historial de Tabarnia — The Flash",
    });

    const model = await mockRoomQueries.listHistory("tabarnia-room", mockQueryContext());
    if (!model) throw new Error("Expected history model");
    const markup = renderToStaticMarkup(<FlashPopRoomHistory {...model} />);

    expect(markup).toContain("Historial");
    expect(markup).toContain("5 sept");
    expect(markup).toContain("4 jugadores");
    expect(markup).toContain("Ganador:");
    expect(markup).toContain("Dark");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).toContain('href="/salas/tabarnia-room/historial/tabarnia-challenge-05"');
    expect(markup.match(/Ver ranking/g)).toHaveLength(5);
  });
});
