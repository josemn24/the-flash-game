import { demoIdentity } from "@/data/mock/constants";
import { mockDomainStore } from "@/data/mock/store";
import {
  MockChallengeReadProjection,
  MockCompetitiveChallengeQueries,
  MockDemoChallengeQueries,
} from "@/infrastructure/mock/challengeQueries";
import { MockCurrentViewerProvider } from "@/infrastructure/mock/currentViewer";
import { MockRoomReadProjection } from "@/infrastructure/mock/roomReadProjection";
import {
  MockRoomHistoryQueries,
  MockRoomLobbyQueries,
  MockRoomMemberDetailQueries,
  MockRoomRankingQueries,
  MockRoomSettingsQueries,
} from "@/infrastructure/mock/roomReadQueries";
import { MockRoomMembershipCommands } from "@/infrastructure/mock/roomMembershipCommands";

export const mockCurrentViewerProvider = new MockCurrentViewerProvider(
  mockDomainStore,
  demoIdentity.currentPlayerId,
);
const mockRoomProjection = new MockRoomReadProjection(mockDomainStore);
export const mockRoomLobbyQueries = new MockRoomLobbyQueries(mockRoomProjection);
export const mockRoomRankingQueries = new MockRoomRankingQueries(mockRoomProjection);
export const mockRoomSettingsQueries = new MockRoomSettingsQueries(mockRoomProjection);
export const mockRoomHistoryQueries = new MockRoomHistoryQueries(mockRoomProjection);
export const mockRoomMemberDetailQueries = new MockRoomMemberDetailQueries(mockRoomProjection);
const mockChallengeProjection = new MockChallengeReadProjection(mockDomainStore);
export const mockDemoChallengeQueries = new MockDemoChallengeQueries(mockChallengeProjection);
export const mockCompetitiveChallengeQueries = new MockCompetitiveChallengeQueries(
  mockChallengeProjection,
);
export const mockRoomMembershipCommands = new MockRoomMembershipCommands(
  mockDomainStore,
  mockCurrentViewerProvider,
);
