import type { AnswerValue } from "@/types/contracts";
import type { AnswerResult } from "@/types/gameplay/result";
import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerAlphabetProgress } from "@/types/gameplay/challenge";
import { questionFromAlphabetPayload } from "../../serverAlphabetQuestionAdapter";
import { questionFromPayload } from "../../serverFlashQuestionAdapter";
import { slotsFor } from "../modes/policy";
import { parseCompetitiveTimestamp, type CompetitiveJsonObject } from "../transport";
import type { SessionRuntime } from "./runtime";
import type { SessionEvent } from "./sessionReducer";
export function initialResults(context: GameRoomContext): AnswerResult[] {
  return (context.result?.attempt?.answers ?? []).map((answer) => ({
    questionId: answer.questionId,
    answer: answer.answer,
    status: answer.status,
    isCorrect: answer.isCorrect,
    points: answer.points ?? 0,
    timeUsed: answer.timeUsed ?? 0,
    ...(answer.details ? { details: answer.details } : {}),
  }));
}
export function recoveredResults(value: unknown): AnswerResult[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    questionId: String(item.challengeItemId),
    answer: item.answer as AnswerValue | null,
    status: item.status as AnswerResult["status"],
    isCorrect: item.status === "correct" || item.status === "partial",
    points: Number(item.points ?? 0),
    timeUsed: Number(item.timeUsedMs ?? 0) / 1000,
    ...(item.resultDetails ? { details: item.resultDetails as AnswerResult["details"] } : {}),
  }));
}
export const timestamp = (value: unknown) =>
  value === null || value === undefined ? null : parseCompetitiveTimestamp(value);
export function preparedEvent(
  runtime: SessionRuntime,
  response: CompetitiveJsonObject,
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
    attempt: { id: attempt.id, lockVersion: Number(response.lockVersion) },
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
