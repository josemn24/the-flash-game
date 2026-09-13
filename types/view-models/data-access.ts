import type { PlayerId, UtcIsoDateTime } from "@/types/domain";
import type { Challenge } from "@/types/gameplay";
import type {
  GameRoomContext,
  RoomCardModel,
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomHistoryEntry,
  RoomLeaderboardEntry,
  RoomMemberDetailModel,
  RoomSettingsModel,
} from "@/types/view-models/room";
import type { UserProfile } from "@/types/view-models/user";

export type QueryContext = {
  readonly viewerId: PlayerId;
  readonly now: UtcIsoDateTime;
};

export type ViewerProfile = UserProfile & {
  readonly playerId: PlayerId;
};

export type HomePageModel = {
  readonly rooms: RoomCardModel[];
  readonly currentViewer: UserProfile;
};

export type RoomRankingModel = {
  readonly roomId: string;
  readonly roomTitle: string;
  readonly currentUserId: string;
  readonly entries: RoomLeaderboardEntry[];
};

export type RoomHistoryListModel = {
  readonly roomId: string;
  readonly roomTitle: string;
  readonly entries: RoomHistoryEntry[];
  readonly rankings: Record<string, RoomDailyLeaderboardEntry[]>;
};

export type RoomHistoryDetailModel = {
  readonly roomId: string;
  readonly roomTitle: string;
  readonly currentUserId: string;
  readonly entry: RoomHistoryEntry;
  readonly ranking: RoomDailyLeaderboardEntry[];
};

export type FlashPopSocialPlayerModel = {
  readonly id: string;
  readonly displayName: string;
  readonly initials: string;
  readonly tone: "social" | "coral" | "blue" | "aqua" | "ink" | "reward";
};

export type FlashPopSocialPeerModel = {
  readonly player: FlashPopSocialPlayerModel;
  readonly flashPoints: number;
  readonly timeUsed: number;
  readonly correctAnswers: number;
  readonly lastCorrectAt: number | null;
  readonly completedAt: string;
};

export type FlashPopSocialSnapshot = {
  readonly currentPlayer: FlashPopSocialPlayerModel;
  readonly players: readonly FlashPopSocialPlayerModel[];
  readonly peers: readonly FlashPopSocialPeerModel[];
};

export type PlayableChallengePageModel = {
  /**
   * Proyección gameplay temporal que todavía contiene soluciones para la evaluación local.
   * No constituye un DTO seguro para un backend real.
   */
  readonly challenge: Challenge;
  readonly roomContext?: GameRoomContext;
  readonly socialSnapshot: FlashPopSocialSnapshot;
};

export type FlashPopLobbyPageModel = {
  readonly primary: PlayableChallengePageModel;
  readonly secondary: PlayableChallengePageModel;
  readonly currentViewer: UserProfile;
};

export type RoomQueryResultMap = {
  detail: RoomDetailModel;
  settings: RoomSettingsModel;
  ranking: RoomRankingModel;
  memberDetail: RoomMemberDetailModel;
  history: RoomHistoryListModel;
  historyDetail: RoomHistoryDetailModel;
};
