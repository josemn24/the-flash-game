import type {
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
  RoomSettingsQueries,
} from "@/application/queries";
import { MockRoomReadProjection } from "./roomQueries";

export class MockRoomLobbyQueries implements RoomLobbyQueries {
  constructor(private readonly delegate: MockRoomReadProjection) {}

  listCards(context: Parameters<RoomLobbyQueries["listCards"]>[0]) {
    return this.delegate.listCards(context);
  }

  getDetail(roomKey: string, context: Parameters<RoomLobbyQueries["getDetail"]>[1]) {
    return this.delegate.getDetail(roomKey, context);
  }

  getIntroduction(
    roomKey: string,
    challengeKey: string,
    context: Parameters<RoomLobbyQueries["getIntroduction"]>[2],
  ) {
    return this.delegate.getIntroduction(roomKey, challengeKey, context);
  }
}

export class MockRoomRankingQueries implements RoomRankingQueries {
  constructor(private readonly delegate: MockRoomReadProjection) {}

  getRanking(roomKey: string, context: Parameters<RoomRankingQueries["getRanking"]>[1]) {
    return this.delegate.getRanking(roomKey, context);
  }
}

export class MockRoomSettingsQueries implements RoomSettingsQueries {
  constructor(private readonly delegate: MockRoomReadProjection) {}

  getSettings(roomKey: string, context: Parameters<RoomSettingsQueries["getSettings"]>[1]) {
    return this.delegate.getSettings(roomKey, context);
  }
}

export class MockRoomHistoryQueries implements RoomHistoryQueries {
  constructor(private readonly delegate: MockRoomReadProjection) {}

  listHistory(roomKey: string, context: Parameters<RoomHistoryQueries["listHistory"]>[1]) {
    return this.delegate.listHistory(roomKey, context);
  }

  getHistoryDetail(
    roomKey: string,
    publicationKey: string,
    context: Parameters<RoomHistoryQueries["getHistoryDetail"]>[2],
  ) {
    return this.delegate.getHistoryDetail(roomKey, publicationKey, context);
  }
}

export class MockRoomMemberDetailQueries implements RoomMemberDetailQueries {
  constructor(private readonly delegate: MockRoomReadProjection) {}

  getMemberDetail(
    roomKey: string,
    memberKey: string,
    context: Parameters<RoomMemberDetailQueries["getMemberDetail"]>[2],
    publicationKey?: string,
  ) {
    return this.delegate.getMemberDetail(roomKey, memberKey, context, publicationKey);
  }
}
