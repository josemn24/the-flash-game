import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomHistory } from "@/components/game/modes/flash-pop/FlashPopRoomHistory";
import { demoRoom } from "@/data/demoRoom";
import { getRoomHistory } from "@/data/roomHistory";
import { generateMetadata, generateStaticParams } from "./page";

describe("room history route", () => {
  it("exposes Tabarnia and renders previous games", async () => {
    expect(generateStaticParams()).toEqual([{ roomId: "tabarnia-room" }]);
    await expect(generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) })).resolves.toMatchObject({
      title: "Historial de Tabarnia — Flash Pop",
    });

    const markup = renderToStaticMarkup(
      <FlashPopRoomHistory
        roomId={demoRoom.id}
        roomTitle={demoRoom.title}
        members={demoRoom.members}
        entries={getRoomHistory(demoRoom.id)}
      />,
    );

    expect(markup).toContain("Historial");
    expect(markup).toContain("5 sept");
    expect(markup).toContain("4 jugadores");
    expect(markup).toContain("Ganador:");
    expect(markup).toContain("Dark");
    expect(markup).toContain('href="/salas/tabarnia-room"');
  });
});
