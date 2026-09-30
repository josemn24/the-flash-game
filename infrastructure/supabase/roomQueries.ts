import type { CurrentViewerReader } from "@/application/ports/current-viewer";
import type { PrivateQuestionAssetResolver } from "@/application/ports/private-question-assets";
import type {
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
  RoomSettingsQueries,
} from "@/application/queries";
import {
  supabaseAttemptExpiration,
  type AttemptExpirationQueries,
} from "@/infrastructure/supabase/attemptExpiration";
import { supabaseCurrentViewerReader } from "@/infrastructure/supabase/currentViewer";
import { supabasePrivateQuestionAssetResolver } from "@/infrastructure/supabase/privateQuestionAssetResolver";
import { SupabaseRoomHistoryQueries } from "./roomHistoryQueries";
import { SupabaseRoomLobbyQueries } from "./roomLobbyQueries";
import { SupabaseRoomMemberDetailQueries } from "./roomMemberDetailQueries";
import { SupabaseRoomRankingQueries } from "./roomRankingQueries";
import { SupabaseRoomSettingsQueries } from "./roomSettingsQueries";

export class SupabaseRoomQueries
  implements
    RoomHistoryQueries,
    RoomLobbyQueries,
    RoomMemberDetailQueries,
    RoomRankingQueries,
    RoomSettingsQueries
{
  private readonly lobbyQueries: RoomLobbyQueries;
  private readonly rankingQueries: RoomRankingQueries;
  private readonly settingsQueries: RoomSettingsQueries;
  private readonly historyQueries: RoomHistoryQueries;
  private readonly memberDetailQueries: RoomMemberDetailQueries;

  constructor(
    private readonly attemptExpiration: AttemptExpirationQueries = supabaseAttemptExpiration,
    currentViewer: CurrentViewerReader = supabaseCurrentViewerReader,
    privateQuestionAssets: PrivateQuestionAssetResolver = supabasePrivateQuestionAssetResolver,
  ) {
    this.lobbyQueries = new SupabaseRoomLobbyQueries(currentViewer);
    this.rankingQueries = new SupabaseRoomRankingQueries(currentViewer);
    this.settingsQueries = new SupabaseRoomSettingsQueries(currentViewer);
    this.historyQueries = new SupabaseRoomHistoryQueries(this.attemptExpiration, currentViewer);
    this.memberDetailQueries = new SupabaseRoomMemberDetailQueries(
      this.attemptExpiration,
      currentViewer,
      privateQuestionAssets,
    );
  }

  async listCards() {
    return this.lobbyQueries.listCards();
  }

  async getDetail(roomKey: string) {
    return this.lobbyQueries.getDetail(roomKey);
  }

  async getIntroduction(roomKey: string, challengeKey: string) {
    return this.lobbyQueries.getIntroduction(roomKey, challengeKey);
  }

  async getRanking(roomKey: string) {
    return this.rankingQueries.getRanking(roomKey);
  }

  async getSettings(roomKey: string) {
    return this.settingsQueries.getSettings(roomKey);
  }

  async listHistory(roomKey: string) {
    return this.historyQueries.listHistory(roomKey);
  }

  async getHistoryDetail(roomKey: string, publicationKey: string) {
    return this.historyQueries.getHistoryDetail(roomKey, publicationKey);
  }

  async getMemberDetail(roomKey: string, memberKey: string, publicationKey?: string) {
    return this.memberDetailQueries.getMemberDetail(roomKey, memberKey, publicationKey);
  }
}

export const supabaseRoomQueries = new SupabaseRoomQueries();
