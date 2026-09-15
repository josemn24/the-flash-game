import "server-only";

import { cache } from "react";
import {
  mockChallengeQueries,
  mockCurrentViewerProvider,
  mockRoomQueries,
} from "@/infrastructure/mock/composition";
import type { UtcIsoDateTime } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";

const getCurrentViewer = cache(() => mockCurrentViewerProvider.getCurrentViewer());

const getQueryContext = cache(async (): Promise<QueryContext> => {
  const viewer = await getCurrentViewer();
  return {
    viewerId: viewer.playerId,
    now: new Date().toISOString() as UtcIsoDateTime,
  };
});

export const getHomePageModel = cache(async () => {
  const viewer = await getCurrentViewerProfile();
  if (!viewer) return null;

  // S01 owns the authenticated home. Rooms become real in S02; do not mix
  // demo memberships with an authenticated Player.
  return { rooms: [], currentViewer: viewer };
});

export const getRoomDetailPageModel = cache(async (roomKey: string) =>
  mockRoomQueries.getDetail(roomKey, await getQueryContext()),
);

export const getRoomSettingsPageModel = cache(async (roomKey: string) =>
  mockRoomQueries.getSettings(roomKey, await getQueryContext()),
);

export const getRoomRankingPageModel = cache(async (roomKey: string) =>
  mockRoomQueries.getRanking(roomKey, await getQueryContext()),
);

export const getRoomMemberDetailPageModel = cache(async (roomKey: string, memberKey: string) =>
  mockRoomQueries.getMemberDetail(roomKey, memberKey, await getQueryContext()),
);

export const getRoomHistoryPageModel = cache(async (roomKey: string) =>
  mockRoomQueries.listHistory(roomKey, await getQueryContext()),
);

export const getRoomHistoryDetailPageModel = cache(async (roomKey: string, challengeKey: string) =>
  mockRoomQueries.getHistoryDetail(roomKey, challengeKey, await getQueryContext()),
);

export const getPlayableChallengePageModel = cache(
  async (challengeKey: string, roomKey: string | null = null) =>
    mockChallengeQueries.getPlayable(challengeKey, roomKey, await getQueryContext()),
);

export const getFlashPopLobbyPageModel = cache(async () =>
  mockChallengeQueries.getFlashPopLobby(await getQueryContext()),
);
