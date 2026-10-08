import "server-only";

import { cache } from "react";
import { productionAdminServices } from "@/server/composition/admin";

export const getSuperadminDashboardPageModel = cache(() =>
  productionAdminServices.reads.getDashboard(),
);

export const getSuperadminOperatorPageModel = cache(() =>
  productionAdminServices.reads.getOperator(),
);

export const getSuperadminNewQuestionPageModel = cache(() =>
  productionAdminServices.reads.getOperator().then((operator) => ({ operator })),
);

export const getSuperadminQuestionVersionPageModel = cache(async (questionVersionId: string) =>
  productionAdminServices.reads.getQuestionVersion(questionVersionId),
);

export const getSuperadminRoomsPageModel = cache(() => productionAdminServices.reads.getRooms());

export const getSuperadminChallengesPageModel = cache(() =>
  productionAdminServices.reads.getChallengeCatalog(),
);

export const getSuperadminNewChallengePageModel = cache(() =>
  productionAdminServices.reads.getNewChallenge(),
);

export const getSuperadminChallengeDetailPageModel = cache(
  (challengeDefinitionId: string, comparisonIds?: readonly [string, string]) =>
    productionAdminServices.reads.getChallengeDetail(challengeDefinitionId, comparisonIds),
);

export const getSuperadminRoomDetailPageModel = cache((roomId: string) =>
  productionAdminServices.reads.getRoomDetail(roomId),
);

export const getSuperadminAttemptPublicationsPageModel = cache((roomId: string) =>
  productionAdminServices.reads.getAttemptPublications(roomId),
);

export const getSuperadminAttemptListPageModel = cache(
  (
    roomId: string,
    scheduledChallengeId: string,
    cursor?: { readonly startedAt: string; readonly attemptId: string } | null,
  ) => productionAdminServices.reads.getAttemptList(roomId, scheduledChallengeId, cursor),
);

export const getSuperadminAttemptInspectionPageModel = cache(
  (roomId: string, scheduledChallengeId: string, attemptId: string) =>
    productionAdminServices.reads.getAttemptInspection(roomId, scheduledChallengeId, attemptId),
);

export const getSuperadminSeasonsPageModel = getSuperadminRoomsPageModel;

export const getSuperadminQuestionLibraryPageModel = cache(() =>
  productionAdminServices.reads.getQuestionLibrary({ status: "all" }),
);
