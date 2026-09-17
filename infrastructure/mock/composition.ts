import { demoIdentity, roomRouteAliases } from "@/data/mock/constants";
import { mockDomainStore } from "@/data/mock/store";
import { MockChallengeQueries } from "@/infrastructure/mock/challengeQueries";
import { MockCurrentViewerProvider } from "@/infrastructure/mock/currentViewer";
import { MockRoomQueries } from "@/infrastructure/mock/roomQueries";
import { mocksEnabled } from "@/server/runtime-scope";

export const mockCurrentViewerProvider = new MockCurrentViewerProvider(
  mockDomainStore,
  demoIdentity.currentPlayerId,
);
export const mockRoomQueries = new MockRoomQueries(mockDomainStore);
export const mockChallengeQueries = new MockChallengeQueries(mockDomainStore);

export function isMockRoomRoute(roomKey: string) {
  return Object.hasOwn(roomRouteAliases, roomKey);
}

export function isMockRoomRouteEnabled(roomKey: string) {
  return mocksEnabled() && isMockRoomRoute(roomKey);
}
