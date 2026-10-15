import type { GameAppProps } from "./gameAppTypes";
import type { Challenge, CompetitiveChallenge, ChallengeCompletionResult } from "@/types/gameplay";
import type {
  GameRoomContext,
  FlashPopSocialSnapshot,
  CompetitiveChallengePageModel,
} from "@/types/view-models";
import type { MiniWordleCompetitiveInputProps } from "@/features/question-formats/competitiveInputTypes";
import type { MiniWordleViewProps } from "@/components/questions/formats/mini-wordle/MiniWordleView";

type Assert<T extends true> = T;
type Rejected<T> = T extends GameAppProps ? false : true;
type Common = { socialSnapshot: FlashPopSocialSnapshot };
export type GameAppContractAssertions = [
  Assert<Rejected<Common & { persistence: "server"; challenge: CompetitiveChallenge }>>,
  Assert<
    Rejected<Common & { persistence: "server"; challenge: Challenge; roomContext: GameRoomContext }>
  >,
  Assert<
    Rejected<
      Common & {
        persistence: "server";
        challenge: CompetitiveChallenge;
        roomContext: GameRoomContext;
        onComplete: (result: ChallengeCompletionResult) => void;
      }
    >
  >,
  Assert<
    Rejected<Common & { persistence: "mock"; challenge: Challenge; roomContext: GameRoomContext }>
  >,
  Assert<Rejected<Common & { challenge: Challenge }>>,
  Assert<Challenge extends CompetitiveChallengePageModel["challenge"] ? false : true>,
  Assert<"correctAnswer" extends keyof MiniWordleViewProps ? false : true>,
  Assert<"onQueensValidate" extends keyof MiniWordleCompetitiveInputProps ? false : true>,
  Assert<MiniWordleCompetitiveInputProps["question"]["type"] extends "mini-wordle" ? true : false>,
];
