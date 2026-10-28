import type { AnswerResult } from "@/types/gameplay/result";
import type {
  CompetitiveChallenge,
  ServerNarrativeStep,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { SessionPhase, SessionReview, SessionState } from "../core/sessionReducer";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
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
import { timeTrialPolicy } from "./timeTrial";
import { alphabetPolicy } from "./alphabet";
import type { FinalizationPolicy } from "./finalization";

export type { CompetitiveChallenge } from "@/types/gameplay/challenge";
export type ModeStep =
  | { type: "prepare" }
  | { type: "complete" }
  | { type: "phase"; phase: SessionPhase; stepIndex: number; questionIndex?: number };
export type ModePolicy = {
  finalization: FinalizationPolicy;
  initialPhase: SessionPhase;
  sequence: readonly ServerNarrativeStep[];
  position: (itemId: string) => number;
  next: (state: SessionState) => ModeStep;
  recover: (state: SessionState, response: AuthoritativeSessionUpdate) => ModeStep;
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
    case "time-trial":
      return timeTrialPolicy(challenge);
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
  if (challenge.mode === "time-trial")
    return challengeWithReview(
      {
        ...challenge,
        mode: "flash",
        slots: challenge.slots.filter((slot) =>
          rows.some((row) => row.challengeItemId === slot.id && row.publicPayload != null),
        ),
      },
      rows,
    );
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
