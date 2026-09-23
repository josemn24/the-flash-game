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
import { supabaseSurvivalQueries } from "@/infrastructure/supabase/survivalQueries";
import { supabasePyramidQueries } from "@/infrastructure/supabase/pyramidQueries";
import type { UtcIsoDateTime } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";
import { getCurrentViewerProfile } from "@/server/profile";
import { requireSuperadmin } from "@/server/admin";
import { supabaseSuperadminEditorialQueries } from "@/infrastructure/supabase/superadminEditorialQueries";
import { supabaseSuperadminCalendarQueries } from "@/infrastructure/supabase/superadminCalendarQueries";
import { supabaseSuperadminRoomQueries } from "@/infrastructure/supabase/superadminQueries";
import { supabaseSuperadminDashboardQueries } from "@/infrastructure/supabase/superadminDashboardQueries";
import { mocksEnabled } from "@/server/runtime-scope";
import type {
  EditorialContentStatus,
  SuperadminChallengeSummary,
  SuperadminEditorialEntry,
} from "@/types/view-models/editorial";

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
    : isMockRoomRoute(roomKey)
      ? null
      : supabaseRoomQueries.getSettings(roomKey),
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
      return (
        (await supabaseFlashQueries.getPlayable(roomKey, challengeKey)) ??
        (await supabaseAlphabetQueries.getPlayable(roomKey, challengeKey)) ??
        (await supabaseSurvivalQueries.getPlayable(roomKey, challengeKey)) ??
        supabasePyramidQueries.getPlayable(roomKey, challengeKey)
      );
    }
    if (!mocksEnabled()) return null;
    return mockChallengeQueries.getPlayable(challengeKey, roomKey, await getQueryContext());
  },
);

export const getFlashPopLobbyPageModel = cache(async () =>
  mockChallengeQueries.getFlashPopLobby(await getQueryContext()),
);

export const getSuperadminDashboardPageModel = cache(async () => {
  // Keep the page behind the same server-side guard as every other portal entry point.
  await requireSuperadmin();
  return supabaseSuperadminDashboardQueries.getDashboard();
});

export const getSuperadminOperatorPageModel = cache(async () => {
  const access = await requireSuperadmin();
  return access.context.operator;
});

export const getSuperadminNewQuestionPageModel = cache(async () => {
  const access = await requireSuperadmin();
  return { operator: access.context.operator };
});

export const getSuperadminQuestionVersionPageModel = cache(async (questionVersionId: string) => {
  const access = await requireSuperadmin();
  return {
    operator: access.context.operator,
    detail: await supabaseSuperadminEditorialQueries.getQuestionVersion(questionVersionId),
  };
});

export const getSuperadminRoomsPageModel = cache(async () => {
  const access = await requireSuperadmin();
  return {
    operator: access.context.operator,
    rooms: access.context.rooms,
    source: "supabase" as const,
  };
});

function summarizeChallengeEntries(
  entries: readonly SuperadminEditorialEntry[],
): SuperadminChallengeSummary {
  const latest = entries[0];
  if (!latest) throw new Error("A challenge detail must contain at least one Flash version.");
  const statusCounts: Record<EditorialContentStatus, number> = {
    draft: 0,
    published: 0,
    archived: 0,
  };
  for (const entry of entries) statusCounts[entry.status] += 1;
  return {
    challengeDefinitionId: latest.challengeDefinitionId,
    slug: latest.slug,
    title: latest.title,
    subtitle: latest.subtitle,
    description: latest.description,
    mode: latest.mode,
    questionCount: latest.questionCount,
    versionCount: entries.length,
    status: latest.status,
    statusCounts,
    updatedAt: latest.updatedAt,
    latestVersion: {
      challengeVersionId: latest.challengeVersionId,
      versionNumber: latest.versionNumber,
      status: latest.status,
      questionCount: latest.questionCount,
      updatedAt: latest.updatedAt,
      publishedAt: latest.publishedAt,
    },
  };
}

export const getSuperadminChallengesPageModel = cache(async () => {
  const access = await requireSuperadmin();
  const catalog = await supabaseSuperadminEditorialQueries.getChallengeCatalog();
  return {
    operator: access.context.operator,
    challenges: catalog.entries,
    source: "supabase" as const,
  };
});

export const getSuperadminNewChallengePageModel = cache(async () => {
  const access = await requireSuperadmin();
  return {
    operator: access.context.operator,
    editorial: { entries: [], source: "supabase" as const },
    questionLibrary: await supabaseSuperadminEditorialQueries.getQuestionLibrary({ status: "all" }),
  };
});

export const getSuperadminChallengeDetailPageModel = cache(
  async (challengeDefinitionId: string) => {
    const access = await requireSuperadmin();
    const [detail, questionLibrary] = await Promise.all([
      supabaseSuperadminEditorialQueries.getChallengeDetail(challengeDefinitionId),
      supabaseSuperadminEditorialQueries.getQuestionLibrary({ status: "all" }),
    ]);
    if (!detail) return null;
    return {
      operator: access.context.operator,
      challenge: summarizeChallengeEntries(detail.entries),
      editorial: { entries: detail.entries, source: "supabase" as const },
      questionLibrary,
      source: "supabase" as const,
    };
  },
);

export const getSuperadminRoomDetailPageModel = cache(async (roomId: string) => {
  const access = await requireSuperadmin();
  const detail = await supabaseSuperadminRoomQueries.getDetail(roomId);
  if (!detail) return null;

  const [calendar, editorial] = await Promise.all([
    supabaseSuperadminCalendarQueries.getContext(roomId),
    supabaseSuperadminEditorialQueries.getContext(),
  ]);

  return {
    operator: access.context.operator,
    room: detail.room,
    members: detail.members,
    calendar,
    publishedContent: editorial.entries.filter((entry) => entry.status === "published"),
    source: "supabase" as const,
  };
});

export const getSuperadminSeasonsPageModel = getSuperadminRoomsPageModel;

export const getSuperadminQuestionLibraryPageModel = cache(async () => {
  const access = await requireSuperadmin();
  return {
    operator: access.context.operator,
    library: await supabaseSuperadminEditorialQueries.getQuestionLibrary({ status: "all" }),
  };
});
