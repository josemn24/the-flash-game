import type { ServerAlphabetProgress } from "@/types/gameplay/challenge";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
import { questionFromAlphabetPayload } from "../../serverAlphabetQuestionAdapter";
import { questionFromPayload } from "../../serverFlashQuestionAdapter";
import { slotsFor } from "../modes/policy";
import type { SessionRuntime } from "./runtime";
import type { SessionEvent } from "./sessionReducer";
export function timestamp(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid_session_timestamp");
  return parsed;
}
export function preparedEvent(
  runtime: SessionRuntime,
  response: AuthoritativeSessionUpdate,
): Extract<SessionEvent, { type: "prepared" }> {
  const { challenge, policy } = runtime;
  const itemId = String(response.challengeItemId);
  const slots = slotsFor(challenge);
  const questionIndex = slots.findIndex((slot) => slot.id === itemId);
  const slot = slots[questionIndex];
  const attempt = runtime.state().attempt;
  if (!slot || !attempt) throw new Error("competitive_question_not_found");
  const deadlineAt = timestamp(response.deadlineAt);
  const isAlphabet = challenge.mode === "alphabet";
  const question = isAlphabet
    ? questionFromAlphabetPayload(
        itemId,
        challenge.entries[questionIndex]!.letter,
        response.publicPayload ?? { question: "Tiempo agotado" },
        slot.timeLimitMs,
        slot.points,
        response.answerLength,
      )
    : questionFromPayload(
        itemId,
        response.publicPayload,
        slot.timeLimitMs,
        slot.points,
        slot.questionType as Parameters<typeof questionFromPayload>[4],
        response.progress,
      );
  const preparedPyramid = challenge.mode === "pyramid" && deadlineAt === null;
  const timedOutAlphabet = isAlphabet && response.timedOut === true;
  return {
    type: "prepared",
    attempt: { id: attempt.id, revision: Number(response.revision) },
    question,
    questionIndex,
    stepIndex: challenge.mode === "narrative" ? policy.position(itemId) : 0,
    presentedAt: timestamp(response.presentedAt),
    deadlineAt,
    ...(isAlphabet && response.progress
      ? { progress: response.progress as ServerAlphabetProgress }
      : {}),
    phase: preparedPyramid || timedOutAlphabet ? "preparing" : "playing",
    locked:
      challenge.mode === "narrative"
        ? false
        : preparedPyramid || timedOutAlphabet || response.timedOut === true,
  };
}
