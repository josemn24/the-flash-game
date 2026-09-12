import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopRoomHistoryDetail } from "@/components/game/modes/flash-pop/FlashPopRoomHistoryDetail";
import { demoRoom } from "@/data/demoRoom";
import { getRoomHistory, getRoomHistoryEntry } from "@/data/roomHistory";
import { getHistoryLeaderboard } from "@/lib/roomRankings";
import { generateMetadata, generateStaticParams } from "./page";

describe("room history detail route", () => {
  it("exposes historical challenge rankings", async () => {
    expect(generateStaticParams()).toEqual(
      getRoomHistory(demoRoom.id).map((entry) => ({
        roomId: demoRoom.id,
        challengeId: entry.challengeId,
      })),
    );
    await expect(
      generateMetadata({
        params: Promise.resolve({ roomId: demoRoom.id, challengeId: "tabarnia-challenge-05" }),
      }),
    ).resolves.toMatchObject({
      title: "Ranking de La Pirámide: Cumbre lógica — Tabarnia — Flash Pop",
    });

    const entry = getRoomHistoryEntry(demoRoom.id, "tabarnia-challenge-05");
    const ranking = getHistoryLeaderboard(demoRoom, entry!);

    expect(entry).toBeDefined();
    const markup = renderToStaticMarkup(
      <FlashPopRoomHistoryDetail
        roomId={demoRoom.id}
        roomTitle={demoRoom.title}
        entry={entry!}
        ranking={ranking}
        currentUserId={demoRoom.currentUserId}
      />,
    );

    expect(markup).toContain("La Pirámide: Cumbre lógica");
    expect(markup).toContain("Ranking del desafío");
    expect(markup).toContain("Dark");
    expect(markup).toContain("52");
    expect(markup).toContain("Jackobo");
    expect(markup).toContain("44");
    expect(markup).toContain('href="/salas/tabarnia-room/historial"');
  });

  it("renders an empty state when the challenge has no completed results", () => {
    const entry = getRoomHistoryEntry(demoRoom.id, "tabarnia-challenge-05");

    const markup = renderToStaticMarkup(
      <FlashPopRoomHistoryDetail
        roomId={demoRoom.id}
        roomTitle={demoRoom.title}
        entry={entry!}
        ranking={[]}
        currentUserId={demoRoom.currentUserId}
      />,
    );

    expect(markup).toContain("No hay resultados disponibles.");
  });
});
