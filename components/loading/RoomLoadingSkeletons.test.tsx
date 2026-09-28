import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GlobalLoading,
  RoomCollectionSkeleton,
  RoomDetailSkeleton,
  RoomHistoryDetailSkeleton,
  RoomHistorySkeleton,
  RoomMemberDetailSkeleton,
  RoomRankingSkeleton,
  RoomSettingsSkeleton,
} from ".";

describe("room loading skeletons", () => {
  it.each([
    ["global", <GlobalLoading key="global" />],
    ["room collection", <RoomCollectionSkeleton key="room-collection" />],
    ["room detail", <RoomDetailSkeleton key="room-detail" />],
    ["room ranking", <RoomRankingSkeleton key="room-ranking" />],
    ["room history", <RoomHistorySkeleton key="room-history" />],
    ["history detail", <RoomHistoryDetailSkeleton key="history-detail" />],
    ["member detail", <RoomMemberDetailSkeleton key="member-detail" />],
    ["room settings", <RoomSettingsSkeleton key="room-settings" />],
  ])("renders an accessible status for %s", (_name, element) => {
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Cargando…");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("keeps the room detail skeleton aligned with the shared UI primitives", () => {
    const markup = renderToStaticMarkup(<RoomDetailSkeleton />);

    expect(markup).toContain('data-surface="surface"');
    expect(markup).toContain('data-elevation="hero"');
    expect(markup).toContain('data-density="none"');
    expect(markup).toContain("challengeArt");
    expect(markup).toContain("leaderboardRows");
  });

  it("keeps the collection skeleton responsive to the room-card layout", () => {
    const markup = renderToStaticMarkup(<RoomCollectionSkeleton />);

    expect(markup).toContain("collectionGrid");
    expect(markup.match(/<article/g)).toHaveLength(3);
  });
});
