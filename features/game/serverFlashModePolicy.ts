import type { AnswerResult } from "@/types/gameplay/result";
import type {
  ServerFlashChallenge,
  ServerPyramidChallenge,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import { deriveCompetitivePyramidProgress } from "@/lib/gameplay/pyramidProgress";
import { deriveSurvivalProgress } from "@/lib/gameplay/survivalProgress";

export type ServerFlashPlayableChallenge =
  ServerFlashChallenge | ServerSurvivalChallenge | ServerPyramidChallenge;

export function challengeSlots(challenge: ServerFlashPlayableChallenge) {
  return challenge.mode === "pyramid" ? challenge.levels : challenge.slots;
}

export function isTerminalForServerFlashMode(
  challenge: ServerFlashPlayableChallenge,
  questionIndex: number,
  results: readonly AnswerResult[],
): boolean {
  if (challenge.mode === "pyramid") {
    return (
      deriveCompetitivePyramidProgress(challenge.levels.length, results).outcome !== "in_progress"
    );
  }
  if (challenge.mode === "survival") {
    return (
      deriveSurvivalProgress(challenge.lives, challenge.slots.length, results).outcome !==
      "in_progress"
    );
  }
  return questionIndex >= challenge.slots.length - 1;
}

export function supportsServerFlashDraft(questionType: string): boolean {
  return ["classification", "estimation", "heat-map", "zip", "escape", "matching"].includes(
    questionType,
  );
}
