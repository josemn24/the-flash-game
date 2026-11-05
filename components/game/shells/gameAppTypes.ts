import type {
  Challenge,
  ChallengeCompletionResult,
  CompetitiveChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay";
import type { FlashPopSocialSnapshot, GameRoomContext } from "@/types/view-models";
import type { LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";

export type CompetitiveGameAppProps = {
  persistence: "server";
  challenge: CompetitiveChallenge;
  roomContext: GameRoomContext;
  socialSnapshot: FlashPopSocialSnapshot;
  terminalReview?: readonly ServerFlashTerminalReview[];
  onComplete?: never;
  definition?: never;
};

type MockGameAppCommon = {
  persistence: "mock";
  onComplete?: (result: ChallengeCompletionResult) => void;
  roomContext?: never;
  terminalReview?: never;
};

export type MockGameAppProps = MockGameAppCommon &
  (
    | {
        definition: LocalPyramidDefinition;
        challenge?: never;
        returnTo?: string;
        socialSnapshot?: never;
      }
    | {
        challenge: Exclude<Challenge, { mode: "pyramid" }>;
        socialSnapshot: FlashPopSocialSnapshot;
        definition?: never;
      }
  );

export type GameAppProps = CompetitiveGameAppProps | MockGameAppProps;
