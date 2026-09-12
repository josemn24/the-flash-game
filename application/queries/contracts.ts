import type {
  FlashPopLobbyPageModel,
  PlayableChallengePageModel,
  QueryContext,
  RoomCardModel,
  RoomDetailModel,
  RoomHistoryDetailModel,
  RoomHistoryListModel,
  RoomMemberDetailModel,
  RoomRankingModel,
  RoomSettingsModel,
  ViewerProfile,
} from "@/types/view-models";

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

export interface ChallengeQueries {
  getPlayable(
    challengeKey: string,
    roomKey: string | null,
    context: QueryContext,
  ): Promise<PlayableChallengePageModel | null>;
  getFlashPopLobby(context: QueryContext): Promise<FlashPopLobbyPageModel>;
}
