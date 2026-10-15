import type {
  Challenge,
  ChallengeCompletionResult,
  CompetitiveChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay";
import type { FlashPopSocialSnapshot, GameRoomContext } from "@/types/view-models";

export type CompetitiveGameAppProps = {
  persistence: "server";
  challenge: CompetitiveChallenge;
  roomContext: GameRoomContext;
  socialSnapshot: FlashPopSocialSnapshot;
  terminalReview?: readonly ServerFlashTerminalReview[];
  onComplete?: never;
};

export type MockGameAppProps = {
  persistence: "mock";
  challenge: Challenge;
  socialSnapshot: FlashPopSocialSnapshot;
  onComplete?: (result: ChallengeCompletionResult) => void;
  roomContext?: never;
  terminalReview?: never;
};

export type GameAppProps = CompetitiveGameAppProps | MockGameAppProps;
