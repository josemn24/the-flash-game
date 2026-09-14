import { demoIdentity, roomRouteAliases } from "@/data/mock/constants";
import { mockDomainStore } from "@/data/mock/store";
import { getScheduledChallengeRouteKey } from "@/data/mock/selectors";
import { toLegacyRoomHistory, toLegacyRoomSnapshot } from "@/data/mock/legacyAdapters";
import { MockRoomQueries } from "@/infrastructure/mock/roomQueries";
import type { Room, ScheduledChallenge } from "@/types/game";
import type { MockDomainStore } from "@/data/mock/store";
import type { PlayerId, UtcIsoDateTime } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";

export const demoRoom = toLegacyRoomSnapshot(
  roomRouteAliases["tabarnia-room"],
  demoIdentity.currentPlayerId,
) as Room;

export const demoRooms: Room[] = [demoRoom];

export const mockRoomQueries = new MockRoomQueries(mockDomainStore);

export function createMockRoomQueries(store: MockDomainStore = mockDomainStore) {
  return new MockRoomQueries(store);
}

export function mockQueryContext(
  now = new Date(),
  viewerId: PlayerId = demoIdentity.currentPlayerId,
): QueryContext {
  return { viewerId, now: now.toISOString() as UtcIsoDateTime };
}

export function getMockRoomHistory(roomId: string) {
  const roomIdValue = roomRouteAliases[roomId as keyof typeof roomRouteAliases];
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
