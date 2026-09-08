import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomRanking } from "@/components/game/modes/flash-pop/FlashPopRoomRanking";
import { demoRoom } from "@/data/demoRoom";
import { getRoomLeaderboard } from "@/lib/roomRankings";
import { generateMetadata, generateStaticParams } from "./page";

describe("room ranking route", () => {
  it("exposes Tabarnia and renders accumulated points", async () => {
    expect(generateStaticParams()).toEqual([{ roomId: "tabarnia-room" }]);
    await expect(generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) })).resolves.toMatchObject({
      title: "Ranking de Tabarnia — Flash Pop",
    });

    const markup = renderToStaticMarkup(
      <FlashPopRoomRanking
        roomId={demoRoom.id}
        roomTitle={demoRoom.title}
        currentUserId={demoRoom.currentUserId}
        entries={getRoomLeaderboard(demoRoom)}
      />,
    );

    expect(markup).toContain("Ranking de Tabarnia");
    expect(markup).toContain("CHES");
    expect(markup).toContain("184");
    expect(markup).toContain("Tú");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).not.toContain("Ranking de hoy");
    expect(markup).not.toContain("Clasificación de la sala");
    expect(markup).toContain('aria-label="184 Flash Points"');
  });
});
