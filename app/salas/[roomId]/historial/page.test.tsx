import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomHistory } from "@/components/game/modes/flash-pop/FlashPopRoomHistory";
import { demoRoom } from "@/data/demoRoom";
import { getRoomHistory } from "@/data/roomHistory";
import { getHistoryLeaderboard } from "@/lib/roomRankings";
import { generateMetadata, generateStaticParams } from "./page";

describe("room history route", () => {
  it("exposes Tabarnia and renders previous games", async () => {
    expect(generateStaticParams()).toEqual([{ roomId: "tabarnia-room" }]);
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({
      title: "Historial de Tabarnia — Flash Pop",
    });

    const markup = renderToStaticMarkup(
      <FlashPopRoomHistory
        roomId={demoRoom.id}
        entries={getRoomHistory(demoRoom.id)}
        rankings={Object.fromEntries(
          getRoomHistory(demoRoom.id).map((entry) => [
            entry.challengeId,
            getHistoryLeaderboard(demoRoom, entry),
          ]),
        )}
      />,
    );

    expect(markup).toContain("Historial");
    expect(markup).toContain("5 sept");
    expect(markup).toContain("4 jugadores");
    expect(markup).toContain("Ganador:");
    expect(markup).toContain("Dark");
    expect(markup).toContain('href="/salas/tabarnia-room"');
    expect(markup).toContain('href="/salas/tabarnia-room/historial/tabarnia-challenge-05"');
    expect(markup.match(/Ver ranking/g)).toHaveLength(3);
  });
});
