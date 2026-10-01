import { demoIdentity, mockRoomKeys } from "@/data/mock/constants";
import { mockDomainStore } from "@/data/mock/store";
import { getPlayerRouteKey, getScheduledChallengeRouteKey } from "@/data/mock/selectors";
import { toLegacyRoomHistory, toLegacyRoomSnapshot } from "@/data/mock/legacyAdapters";
import type {
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
  RoomSettingsQueries,
} from "@/application/queries";
import { MockRoomReadProjection } from "@/infrastructure/mock/roomQueries";
import {
  MockRoomHistoryQueries,
  MockRoomLobbyQueries,
  MockRoomMemberDetailQueries,
  MockRoomRankingQueries,
  MockRoomSettingsQueries,
} from "@/infrastructure/mock/roomReadQueries";
import type { Room, ScheduledChallenge } from "@/types/game";
import type { MockDomainStore } from "@/data/mock/store";
import type { PlayerId, UtcIsoDateTime } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";

export const demoRoom = toLegacyRoomSnapshot(
  mockRoomKeys["tabarnia-room"],
  demoIdentity.currentPlayerId,
) as Room;

type MockRoomReadCapabilities = RoomHistoryQueries &
  RoomLobbyQueries &
  RoomMemberDetailQueries &
  RoomRankingQueries &
  RoomSettingsQueries;

export function createMockRoomReadCapabilities(store: MockDomainStore): MockRoomReadCapabilities {
  const projection = new MockRoomReadProjection(store);
  const lobby = new MockRoomLobbyQueries(projection);
  const ranking = new MockRoomRankingQueries(projection);
  const settings = new MockRoomSettingsQueries(projection);
  const history = new MockRoomHistoryQueries(projection);
  const memberDetail = new MockRoomMemberDetailQueries(projection);

  return {
    listCards: (context) => lobby.listCards(context),
    getDetail: (roomKey, context) => lobby.getDetail(roomKey, context),
    getIntroduction: (roomKey, challengeKey, context) =>
      lobby.getIntroduction(roomKey, challengeKey, context),
    getRanking: (roomKey, context) => ranking.getRanking(roomKey, context),
    getSettings: (roomKey, context) => settings.getSettings(roomKey, context),
    listHistory: (roomKey, context) => history.listHistory(roomKey, context),
    getHistoryDetail: (roomKey, publicationKey, context) =>
      history.getHistoryDetail(roomKey, publicationKey, context),
    getMemberDetail: (roomKey, memberKey, context, publicationKey) =>
      memberDetail.getMemberDetail(roomKey, memberKey, context, publicationKey),
  };
}

export const mockRoomReadCapabilities = createMockRoomReadCapabilities(mockDomainStore);

export function mockQueryContext(
  now = new Date(),
  viewerId: PlayerId = demoIdentity.currentPlayerId,
): QueryContext {
  const player = mockDomainStore.players.find(({ id }) => id === viewerId);
  const routeKey = getPlayerRouteKey(viewerId);
  if (!player || !routeKey) throw new Error(`Unknown mock viewer "${viewerId}".`);
  return {
    viewer: {
      playerId: viewerId,
      id: routeKey,
      name: player.displayName,
      avatarSrc: player.avatarPath ?? undefined,
    },
    now: now.toISOString() as UtcIsoDateTime,
  };
}

export function getMockRoomHistory(roomId: string) {
  const roomIdValue = mockRoomKeys[roomId as keyof typeof mockRoomKeys];
  return roomIdValue ? toLegacyRoomHistory(roomIdValue) : [];
}

export function getMockRoomHistoryEntry(roomId: string, challengeId: string) {
  return getMockRoomHistory(roomId).find((entry) => entry.challengeId === challengeId);
}

export const mockScheduledChallenges: ScheduledChallenge[] =
  mockDomainStore.scheduledChallenges.map((scheduledChallenge) => {
    const routeKey = getScheduledChallengeRouteKey(scheduledChallenge.id);
    const version = mockDomainStore.challengeVersions.find(
      ({ id }) => id === scheduledChallenge.challengeVersionId,
    );
    const definition = version
      ? mockDomainStore.challengeDefinitions.find(({ id }) => id === version.challengeDefinitionId)
      : undefined;
    if (!routeKey || !definition) {
      throw new Error(`Cannot project scheduled challenge "${scheduledChallenge.id}".`);
    }
    return {
      id: routeKey,
      number: scheduledChallenge.number,
      seasonId: "tabarnia-season-1",
      challengeDefinitionId: definition.slug,
      availableFrom: scheduledChallenge.opensAt,
      availableUntil: scheduledChallenge.closesAt,
    };
  });
