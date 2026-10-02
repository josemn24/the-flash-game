import type { AnswerResult } from "@/types/gameplay/result";
import type {
  ServerAlphabetChallenge,
  ServerFlashChallenge,
  ServerNarrativeChallenge,
  ServerNarrativeStep,
  ServerPyramidChallenge,
  ServerSurvivalChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { SessionPhase, SessionReview, SessionState } from "../core/sessionReducer";
import type { CompetitiveJsonObject } from "../transport";
import { alphabetChallengeWithReview } from "../../serverAlphabetQuestionAdapter";
import {
  challengeWithReview,
  questionFromPayload,
  questionWithSolution,
} from "../../serverFlashQuestionAdapter";
import { flashPolicy } from "./flash";
import { survivalPolicy } from "./survival";
import { pyramidPolicy } from "./pyramid";
import { narrativePolicy } from "./narrative";
import { alphabetPolicy } from "./alphabet";

export type CompetitiveChallenge =
  | ServerFlashChallenge
  | ServerSurvivalChallenge
  | ServerPyramidChallenge
  | ServerNarrativeChallenge
  | ServerAlphabetChallenge;
export type ModeStep =
  | { type: "prepare" }
  | { type: "complete" }
  | { type: "phase"; phase: SessionPhase; stepIndex: number; questionIndex?: number };
export type ModePolicy = {
  initialPhase: SessionPhase;
  sequence: readonly ServerNarrativeStep[];
  position: (itemId: string) => number;
  next: (state: SessionState) => ModeStep;
  recover: (state: SessionState, response: CompetitiveJsonObject) => ModeStep;
  terminal: (results: readonly AnswerResult[], questionIndex: number) => boolean;
};
export function slotsFor(challenge: CompetitiveChallenge) {
  return challenge.mode === "pyramid"
    ? challenge.levels
    : challenge.mode === "alphabet"
      ? challenge.entries
      : challenge.slots;
}
export function createModePolicy(challenge: CompetitiveChallenge): ModePolicy {
  switch (challenge.mode) {
    case "flash":
      return flashPolicy(challenge);
    case "survival":
      return survivalPolicy(challenge);
    case "pyramid":
      return pyramidPolicy(challenge);
    case "narrative":
      return narrativePolicy(challenge);
    case "alphabet":
      return alphabetPolicy(challenge);
  }
}
export function reviewFor(
  challenge: CompetitiveChallenge,
  rows: readonly ServerFlashTerminalReview[],
): SessionReview | null {
  if (!rows.length) return null;
  if (challenge.mode === "alphabet") return alphabetChallengeWithReview(challenge, rows);
  if (challenge.mode === "pyramid") return challengeWithReview(challenge, rows);
  if (challenge.mode !== "narrative") return challengeWithReview(challenge, rows);
  const questions = challenge.slots.map((slot) => {
    const row = rows.find((item) => item.challengeItemId === slot.id);
    return questionWithSolution(
      questionFromPayload(
        slot.id,
        row?.publicPayload,
        slot.timeLimitMs,
        slot.points,
        slot.questionType,
        undefined,
        true,
      ),
      row,
    );
  });
  return {
    ...challenge,
    mode: "flash",
    questions,
    questionPoints: Object.fromEntries(challenge.slots.map((slot) => [slot.id, slot.points])),
  };
}
