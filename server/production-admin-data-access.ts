import "server-only";

import { cache } from "react";
import { requireSuperadmin } from "@/server/admin";
import { supabaseSuperadminEditorialQueries } from "@/infrastructure/supabase/admin/superadminEditorialQueries";
import { supabaseSuperadminCalendarQueries } from "@/infrastructure/supabase/admin/superadminCalendarQueries";
import { supabaseSuperadminRoomQueries } from "@/infrastructure/supabase/admin/superadminQueries";
import { supabaseSuperadminAttemptQueries } from "@/infrastructure/supabase/admin/superadminAttemptQueries";
import { supabaseSuperadminDashboardQueries } from "@/infrastructure/supabase/admin/superadminDashboardQueries";
import type {
  EditorialContentStatus,
  SuperadminChallengeSummary,
  SuperadminEditorialEntry,
} from "@/types/view-models/editorial";

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
  async (challengeDefinitionId: string, comparisonIds?: readonly [string, string]) => {
    const access = await requireSuperadmin();
    const [detail, questionLibrary, comparison] = await Promise.all([
      supabaseSuperadminEditorialQueries.getChallengeDetail(challengeDefinitionId),
      supabaseSuperadminEditorialQueries.getQuestionLibrary({ status: "all" }),
      comparisonIds
        ? supabaseSuperadminEditorialQueries.getChallengeVersionComparison(
            comparisonIds[0],
            comparisonIds[1],
          )
        : Promise.resolve(null),
    ]);
    if (!detail) return null;
    return {
      operator: access.context.operator,
      challenge: summarizeChallengeEntries(detail.entries),
      editorial: { entries: detail.entries, source: "supabase" as const },
      questionLibrary,
      comparison,
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

export const getSuperadminAttemptPublicationsPageModel = cache(async (roomId: string) => {
  const access = await requireSuperadmin();
  const publications = await supabaseSuperadminAttemptQueries.listPublications(roomId);
  if (!publications) return null;
  const room = access.context.rooms.find((entry) => entry.roomId === roomId);
  if (!room) return null;
  return {
    operator: access.context.operator,
    roomId,
    roomTitle: room.title,
    publications,
    source: "supabase" as const,
  };
});

export const getSuperadminAttemptListPageModel = cache(
  async (
    roomId: string,
    scheduledChallengeId: string,
    cursor?: { readonly startedAt: string; readonly attemptId: string } | null,
  ) => {
    const access = await requireSuperadmin();
    const list = await supabaseSuperadminAttemptQueries.listAttempts(
      roomId,
      scheduledChallengeId,
      cursor,
    );
    if (!list) return null;
    return {
      operator: access.context.operator,
      ...list,
      source: "supabase" as const,
    };
  },
);

export const getSuperadminAttemptInspectionPageModel = cache(
  async (roomId: string, scheduledChallengeId: string, attemptId: string) => {
    const access = await requireSuperadmin();
    const inspection = await supabaseSuperadminAttemptQueries.getInspection(
      roomId,
      scheduledChallengeId,
      attemptId,
    );
    if (!inspection) return null;
    return {
      operator: access.context.operator,
      ...inspection,
      source: "supabase" as const,
    };
  },
);

export const getSuperadminSeasonsPageModel = getSuperadminRoomsPageModel;

export const getSuperadminQuestionLibraryPageModel = cache(async () => {
  const access = await requireSuperadmin();
  return {
    operator: access.context.operator,
    library: await supabaseSuperadminEditorialQueries.getQuestionLibrary({ status: "all" }),
  };
});
