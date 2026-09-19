import "server-only";

import { cache } from "react";
import {
  isMockRoomRoute,
  isMockRoomRouteEnabled,
  mockChallengeQueries,
  mockCurrentViewerProvider,
  mockRoomQueries,
} from "@/infrastructure/mock/composition";
import { supabaseRoomQueries } from "@/infrastructure/supabase/roomQueries";
import { supabaseFlashQueries } from "@/infrastructure/supabase/flashQueries";
import { supabaseAlphabetQueries } from "@/infrastructure/supabase/alphabetQueries";
import type { UtcIsoDateTime } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";
import { requireSuperadmin } from "@/server/admin";
import { supabaseSuperadminEditorialQueries } from "@/infrastructure/supabase/superadminEditorialQueries";
import { supabaseSuperadminCalendarQueries } from "@/infrastructure/supabase/superadminCalendarQueries";
import { mocksEnabled } from "@/server/runtime-scope";

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
  isMockRoomRouteEnabled(roomKey)
    ? mockRoomQueries.getDetail(roomKey, await getQueryContext())
    : isMockRoomRoute(roomKey)
      ? null
      : supabaseRoomQueries.getDetail(roomKey),
);

export const getRoomIntroductionPageModel = cache(async (roomKey: string, challengeKey: string) =>
  isMockRoomRoute(roomKey) ? null : supabaseRoomQueries.getIntroduction(roomKey, challengeKey),
);

export const getRoomSettingsPageModel = cache(async (roomKey: string) =>
  isMockRoomRouteEnabled(roomKey)
    ? mockRoomQueries.getSettings(roomKey, await getQueryContext())
    : null,
);

export const getRoomRankingPageModel = cache(async (roomKey: string) =>
  isMockRoomRouteEnabled(roomKey)
    ? mockRoomQueries.getRanking(roomKey, await getQueryContext())
    : isMockRoomRoute(roomKey)
      ? null
      : supabaseRoomQueries.getRanking(roomKey),
);

export const getRoomMemberDetailPageModel = cache(
  async (roomKey: string, memberKey: string, publicationKey?: string) =>
    isMockRoomRouteEnabled(roomKey)
      ? mockRoomQueries.getMemberDetail(roomKey, memberKey, await getQueryContext())
      : isMockRoomRoute(roomKey)
        ? null
        : supabaseRoomQueries.getMemberDetail(roomKey, memberKey, publicationKey),
);

export const getRoomHistoryPageModel = cache(async (roomKey: string) =>
  isMockRoomRouteEnabled(roomKey)
    ? mockRoomQueries.listHistory(roomKey, await getQueryContext())
    : isMockRoomRoute(roomKey)
      ? null
      : supabaseRoomQueries.listHistory(roomKey),
);

export const getRoomHistoryDetailPageModel = cache(async (roomKey: string, challengeKey: string) =>
  isMockRoomRouteEnabled(roomKey)
    ? mockRoomQueries.getHistoryDetail(roomKey, challengeKey, await getQueryContext())
    : isMockRoomRoute(roomKey)
      ? null
      : supabaseRoomQueries.getHistoryDetail(roomKey, challengeKey),
);

export const getPlayableChallengePageModel = cache(
  async (challengeKey: string, roomKey: string | null = null) => {
    if (roomKey && isMockRoomRoute(roomKey)) {
      if (!mocksEnabled()) return null;
      return mockChallengeQueries.getPlayable(challengeKey, roomKey, await getQueryContext());
    }
    if (roomKey) {
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(challengeKey)) return null;
      return (await supabaseFlashQueries.getPlayable(roomKey, challengeKey)) ??
        supabaseAlphabetQueries.getPlayable(roomKey, challengeKey);
    }
    if (!mocksEnabled()) return null;
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
    questionLibrary: await supabaseSuperadminEditorialQueries.getQuestionLibrary({ status: "all" }),
    calendar: await supabaseSuperadminCalendarQueries.getContext(),
  };
});
