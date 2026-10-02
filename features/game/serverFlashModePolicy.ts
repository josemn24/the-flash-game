import type { AnswerResult } from "@/types/gameplay/result";
import type {
  ServerFlashChallenge,
  ServerPyramidChallenge,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import { createModePolicy } from "./competitive/modes/policy";
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
  return createModePolicy(challenge).terminal(results, questionIndex);
}
export { supportsServerFlashDraft } from "./competitive/formats/generic";
