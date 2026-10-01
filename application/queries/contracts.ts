import type {
  FlashPopLobbyPageModel,
  CompetitiveChallengePageModel,
  PlayableChallengePageModel,
  QueryContext,
  RoomCardModel,
  RoomDetailModel,
  RoomIntroductionModel,
  RoomHistoryDetailModel,
  RoomHistoryListModel,
  RoomMemberDetailModel,
  RoomRankingModel,
  RoomSettingsModel,
  SuperadminPlayerCandidate,
  SuperadminPortalContext,
  SuperadminDashboardModel,
  SuperadminRoomDetailData,
  SuperadminAttemptInspectionModel,
  SuperadminAttemptListModel,
  SuperadminAttemptPublication,
  ViewerProfile,
} from "@/types/view-models";
import type { SuperadminEditorialQueries } from "@/application/ports/superadmin-editorial-commands";
import type { RoomMembershipCommands } from "@/application/ports/room-membership-commands";

export interface CurrentViewerProvider {
  getCurrentViewer(): Promise<ViewerProfile>;
}

/** Narrow read surface for the authenticated S02 room-lobby slice. */
export interface RoomLobbyQueries {
  listCards(context: QueryContext): Promise<RoomCardModel[]>;
  getDetail(roomKey: string, context: QueryContext): Promise<RoomDetailModel | null>;
  getIntroduction(
    roomKey: string,
    challengeKey: string,
    context: QueryContext,
  ): Promise<RoomIntroductionModel | null>;
}

/** Narrow read surface for the authenticated S06 ranking slice. */
export interface RoomRankingQueries {
  getRanking(roomKey: string, context: QueryContext): Promise<RoomRankingModel | null>;
}

/** Narrow read surface for the authenticated room settings slice. */
export interface RoomSettingsQueries {
  getSettings(roomKey: string, context: QueryContext): Promise<RoomSettingsModel | null>;
}

export type { RoomMembershipCommands };

/** Narrow read surface for the authenticated S07 room history slice. */
export interface RoomHistoryQueries {
  listHistory(roomKey: string, context: QueryContext): Promise<RoomHistoryListModel | null>;
  getHistoryDetail(
    roomKey: string,
    publicationKey: string,
    context: QueryContext,
  ): Promise<RoomHistoryDetailModel | null>;
}

/** Narrow read surface for the authenticated S07 room member review slice. */
export interface RoomMemberDetailQueries {
  getMemberDetail(
    roomKey: string,
    memberKey: string,
    context: QueryContext,
    publicationKey?: string,
  ): Promise<RoomMemberDetailModel | null>;
}

/** Narrow server-only read surface for the beta superadmin portal. */
export interface SuperadminPortalQueries {
  getContext(): Promise<SuperadminPortalContext>;
  lookupPlayersByEmail(emails: readonly string[]): Promise<SuperadminPlayerCandidate[]>;
}

export interface SuperadminDashboardQueries {
  getDashboard(): Promise<SuperadminDashboardModel>;
}

export interface SuperadminRoomQueries {
  getDetail(roomId: string): Promise<SuperadminRoomDetailData | null>;
}

export interface SuperadminAttemptQueries {
  listPublications(roomId: string): Promise<readonly SuperadminAttemptPublication[] | null>;
  listAttempts(
    roomId: string,
    scheduledChallengeId: string,
    cursor?: { readonly startedAt: string; readonly attemptId: string } | null,
  ): Promise<Omit<SuperadminAttemptListModel, "operator" | "source"> | null>;
  getInspection(
    roomId: string,
    scheduledChallengeId: string,
    attemptId: string,
  ): Promise<Omit<SuperadminAttemptInspectionModel, "operator" | "source"> | null>;
}

export type { SuperadminEditorialQueries };

export interface DemoChallengeQueries {
  getPreview(
    challengeKey: string,
    context: QueryContext,
  ): Promise<PlayableChallengePageModel | null>;
  getFlashPopLobby(context: QueryContext): Promise<FlashPopLobbyPageModel>;
}

export interface CompetitiveChallengeQueries {
  getPlayable(
    roomKey: string,
    challengeKey: string,
    context: QueryContext,
  ): Promise<CompetitiveChallengePageModel | null>;
}
