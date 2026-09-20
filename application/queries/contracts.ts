import type {
  FlashPopLobbyPageModel,
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
  ViewerProfile,
} from "@/types/view-models";
import type { SuperadminEditorialQueries } from "@/application/ports/superadmin-editorial-commands";

export interface CurrentViewerProvider {
  getCurrentViewer(): Promise<ViewerProfile>;
}

export interface RoomQueries {
  listCards(context: QueryContext): Promise<RoomCardModel[]>;
  getDetail(roomKey: string, context: QueryContext): Promise<RoomDetailModel | null>;
  getSettings(roomKey: string, context: QueryContext): Promise<RoomSettingsModel | null>;
  getRanking(roomKey: string, context: QueryContext): Promise<RoomRankingModel | null>;
  getMemberDetail(
    roomKey: string,
    memberKey: string,
    context: QueryContext,
  ): Promise<RoomMemberDetailModel | null>;
  listHistory(roomKey: string, context: QueryContext): Promise<RoomHistoryListModel | null>;
  getHistoryDetail(
    roomKey: string,
    challengeKey: string,
    context: QueryContext,
  ): Promise<RoomHistoryDetailModel | null>;
}

/** Narrow read surface for the authenticated S02 room-lobby slice. */
export interface RoomLobbyQueries {
  listCards(): Promise<RoomCardModel[]>;
  getDetail(roomKey: string): Promise<RoomDetailModel | null>;
  getIntroduction(roomKey: string, challengeKey: string): Promise<RoomIntroductionModel | null>;
}

/** Narrow read surface for the authenticated S06 ranking slice. */
export interface RoomRankingQueries {
  getRanking(roomKey: string): Promise<RoomRankingModel | null>;
}

/** Narrow read surface for the authenticated S07 Flash history slice. */
export interface RoomHistoryQueries {
  listHistory(roomKey: string): Promise<RoomHistoryListModel | null>;
  getHistoryDetail(roomKey: string, publicationKey: string): Promise<RoomHistoryDetailModel | null>;
}

/** Narrow read surface for the authenticated S07 member review slice. */
export interface RoomMemberDetailQueries {
  getMemberDetail(
    roomKey: string,
    memberKey: string,
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

export type { SuperadminEditorialQueries };

export interface ChallengeQueries {
  getPlayable(
    challengeKey: string,
    roomKey: string | null,
    context: QueryContext,
  ): Promise<PlayableChallengePageModel | null>;
  getFlashPopLobby(context: QueryContext): Promise<FlashPopLobbyPageModel>;
}
