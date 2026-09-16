import "server-only";

import { cache } from "react";
import {
  isMockRoomRoute,
  mockChallengeQueries,
  mockCurrentViewerProvider,
  mockRoomQueries,
} from "@/infrastructure/mock/composition";
import { supabaseRoomQueries } from "@/infrastructure/supabase/roomQueries";
import { supabaseFlashQueries } from "@/infrastructure/supabase/flashQueries";
import type { UtcIsoDateTime } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";
import { requireSuperadmin } from "@/server/admin";
import { supabaseSuperadminEditorialQueries } from "@/infrastructure/supabase/superadminEditorialQueries";
import { supabaseSuperadminCalendarQueries } from "@/infrastructure/supabase/superadminCalendarQueries";

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
  isMockRoomRoute(roomKey)
    ? mockRoomQueries.getRanking(roomKey, await getQueryContext())
    : supabaseRoomQueries.getRanking(roomKey),
);

export const getRoomMemberDetailPageModel = cache(
  async (roomKey: string, memberKey: string, publicationKey?: string) =>
    isMockRoomRoute(roomKey)
      ? mockRoomQueries.getMemberDetail(roomKey, memberKey, await getQueryContext())
      : supabaseRoomQueries.getMemberDetail(roomKey, memberKey, publicationKey),
);

export const getRoomHistoryPageModel = cache(async (roomKey: string) =>
  isMockRoomRoute(roomKey)
    ? mockRoomQueries.listHistory(roomKey, await getQueryContext())
    : supabaseRoomQueries.listHistory(roomKey),
);

export const getRoomHistoryDetailPageModel = cache(async (roomKey: string, challengeKey: string) =>
  isMockRoomRoute(roomKey)
    ? mockRoomQueries.getHistoryDetail(roomKey, challengeKey, await getQueryContext())
    : supabaseRoomQueries.getHistoryDetail(roomKey, challengeKey),
);

export const getPlayableChallengePageModel = cache(
  async (challengeKey: string, roomKey: string | null = null) => {
    if (roomKey && !isMockRoomRoute(roomKey)) {
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(challengeKey)) return null;
      return supabaseFlashQueries.getPlayable(roomKey, challengeKey);
    }
    return mockChallengeQueries.getPlayable(challengeKey, roomKey, await getQueryContext());
  },
);

export const getFlashPopLobbyPageModel = cache(async () =>
  mockChallengeQueries.getFlashPopLobby(await getQueryContext()),
);

export const getSuperadminPortalPageModel = cache(async () => {
  const access = await requireSuperadmin();
  return {
    ...access.context,
    editorial: await supabaseSuperadminEditorialQueries.getContext(),
    calendar: await supabaseSuperadminCalendarQueries.getContext(),
  };
});
