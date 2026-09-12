import { demoIdentity } from "@/data/mock/constants";
import { mockDomainStore } from "@/data/mock/store";
import { MockChallengeQueries } from "@/infrastructure/mock/challengeQueries";
import { MockCurrentViewerProvider } from "@/infrastructure/mock/currentViewer";
import { MockRoomQueries } from "@/infrastructure/mock/roomQueries";

export const mockCurrentViewerProvider = new MockCurrentViewerProvider(
  mockDomainStore,
  demoIdentity.currentPlayerId,
);
export const mockRoomQueries = new MockRoomQueries(mockDomainStore);
export const mockChallengeQueries = new MockChallengeQueries(mockDomainStore);
