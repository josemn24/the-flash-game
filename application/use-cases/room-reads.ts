import type { Clock } from "@/application/ports/clock";
import { systemClock } from "@/application/ports/clock";
import type { CurrentViewerReader } from "@/application/ports/current-viewer";
import type {
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
  RoomSettingsQueries,
} from "@/application/queries";
import type {
  HomePageModel,
  QueryContext,
  RoomDetailModel,
  RoomHistoryDetailModel,
  RoomHistoryListModel,
  RoomIntroductionModel,
  RoomMemberDetailModel,
  RoomRankingModel,
  RoomSettingsModel,
} from "@/types/view-models";

export type ApplicationRoomReadsDependencies = {
  readonly currentViewer: CurrentViewerReader;
  readonly lobby: RoomLobbyQueries;
  readonly ranking: RoomRankingQueries;
  readonly settings: RoomSettingsQueries;
  readonly history: RoomHistoryQueries;
  readonly memberDetail: RoomMemberDetailQueries;
  readonly clock?: Clock;
};

export class ApplicationRoomReads {
  private readonly currentViewer: CurrentViewerReader;
  private readonly lobby: RoomLobbyQueries;
  private readonly ranking: RoomRankingQueries;
  private readonly settings: RoomSettingsQueries;
  private readonly history: RoomHistoryQueries;
  private readonly memberDetail: RoomMemberDetailQueries;
  private readonly clock: Clock;

  constructor(dependencies: ApplicationRoomReadsDependencies) {
    this.currentViewer = dependencies.currentViewer;
    this.lobby = dependencies.lobby;
    this.ranking = dependencies.ranking;
    this.settings = dependencies.settings;
    this.history = dependencies.history;
    this.memberDetail = dependencies.memberDetail;
    this.clock = dependencies.clock ?? systemClock;
  }

  private async createContext(): Promise<QueryContext | null> {
    const viewer = await this.currentViewer.getCurrentViewer();
    return viewer ? { viewer, now: this.clock.now() } : null;
  }

  async getHome(): Promise<HomePageModel | null> {
    const context = await this.createContext();
    if (!context) return null;
    return {
      rooms: await this.lobby.listCards(context),
      currentViewer: context.viewer,
    };
  }

  async getDetail(roomKey: string): Promise<RoomDetailModel | null> {
    const context = await this.createContext();
    return context ? this.lobby.getDetail(roomKey, context) : null;
  }

  async getIntroduction(
    roomKey: string,
    challengeKey: string,
  ): Promise<RoomIntroductionModel | null> {
    const context = await this.createContext();
    return context ? this.lobby.getIntroduction(roomKey, challengeKey, context) : null;
  }

  async getSettings(roomKey: string): Promise<RoomSettingsModel | null> {
    const context = await this.createContext();
    return context ? this.settings.getSettings(roomKey, context) : null;
  }

  async getRanking(roomKey: string): Promise<RoomRankingModel | null> {
    const context = await this.createContext();
    return context ? this.ranking.getRanking(roomKey, context) : null;
  }

  async listHistory(roomKey: string): Promise<RoomHistoryListModel | null> {
    const context = await this.createContext();
    return context ? this.history.listHistory(roomKey, context) : null;
  }

  async getHistoryDetail(
    roomKey: string,
    challengeKey: string,
  ): Promise<RoomHistoryDetailModel | null> {
    const context = await this.createContext();
    return context ? this.history.getHistoryDetail(roomKey, challengeKey, context) : null;
  }

  async getMemberDetail(
    roomKey: string,
    memberKey: string,
    publicationKey?: string,
  ): Promise<RoomMemberDetailModel | null> {
    const context = await this.createContext();
    return context
      ? this.memberDetail.getMemberDetail(roomKey, memberKey, context, publicationKey)
      : null;
  }
}
