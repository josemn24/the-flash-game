import "server-only";

import { cache } from "react";
import {
  isMockRoomRoute,
  mockChallengeQueries,
  mockCurrentViewerProvider,
  mockRoomQueries,
} from "@/infrastructure/mock/composition";
import { supabaseRoomQueries } from "@/infrastructure/supabase/roomQueries";
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

  return {
    rooms: await supabaseRoomQueries.listCards(),
    currentViewer: viewer,
  };
});

export const getRoomDetailPageModel = cache(async (roomKey: string) =>
  isMockRoomRoute(roomKey)
    ? mockRoomQueries.getDetail(roomKey, await getQueryContext())
    : supabaseRoomQueries.getDetail(roomKey),
);

export const getRoomIntroductionPageModel = cache(async (roomKey: string, challengeKey: string) =>
  supabaseRoomQueries.getIntroduction(roomKey, challengeKey),
);

export const getRoomSettingsPageModel = cache(async (roomKey: string) =>
  isMockRoomRoute(roomKey) ? mockRoomQueries.getSettings(roomKey, await getQueryContext()) : null,
);

export const getRoomRankingPageModel = cache(async (roomKey: string) =>
  isMockRoomRoute(roomKey) ? mockRoomQueries.getRanking(roomKey, await getQueryContext()) : null,
);

export const getRoomMemberDetailPageModel = cache(async (roomKey: string, memberKey: string) =>
  isMockRoomRoute(roomKey)
    ? mockRoomQueries.getMemberDetail(roomKey, memberKey, await getQueryContext())
    : null,
);

export const getRoomHistoryPageModel = cache(async (roomKey: string) =>
  isMockRoomRoute(roomKey) ? mockRoomQueries.listHistory(roomKey, await getQueryContext()) : null,
);

export const getRoomHistoryDetailPageModel = cache(async (roomKey: string, challengeKey: string) =>
  isMockRoomRoute(roomKey)
    ? mockRoomQueries.getHistoryDetail(roomKey, challengeKey, await getQueryContext())
    : null,
);

export const getPlayableChallengePageModel = cache(
  async (challengeKey: string, roomKey: string | null = null) => {
    if (roomKey && !isMockRoomRoute(roomKey)) return null;
    return mockChallengeQueries.getPlayable(challengeKey, roomKey, await getQueryContext());
  },
);

export const getFlashPopLobbyPageModel = cache(async () =>
  mockChallengeQueries.getFlashPopLobby(await getQueryContext()),
);
