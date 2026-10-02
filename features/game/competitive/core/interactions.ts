import { createAlphabetTimeoutGuard } from "../../alphabetTimeoutGuard";
import type { AnswerValue } from "@/types/contracts";
import { supportsServerFlashDraft } from "../formats/generic";
import { interactionFor, normalizeInteraction } from "../formats/adapter";
import type { FormatAction } from "../formats/types";
import type { SessionRuntime } from "./runtime";
import type { createAttemptLifecycle } from "./attemptLifecycle";
export function createInteractions(
  runtime: SessionRuntime,
  lifecycle: ReturnType<typeof createAttemptLifecycle>,
) {
  let reserved = false;
  let validating = false;
  const alphabetTimeout = createAlphabetTimeoutGuard();
  let timeoutItemId: string | null = null;
  let draftRevision = 0;
  let latestQueens: { itemId: string; queens: readonly number[]; revision: number } | null = null;
  let validationIntent: { itemId: string; queens: readonly number[] } | null = null;
  const resumeTimeout = async () => {
    if (
      timeoutItemId &&
      runtime.state().question?.id === timeoutItemId &&
      runtime.state().phase === "playing" &&
      !runtime.state().pendingCommand
    ) {
      timeoutItemId = null;
      await timeoutAnswer();
    }
  };
  const interact = async (action: FormatAction, force = false) => {
    const state = runtime.state();
    const question = state.question;
    if (
      !question ||
      state.attemptExpired ||
      state.pendingCommand ||
      (!force && (reserved || state.locked || state.phase !== "playing"))
    )
      return;
    const spec = interactionFor(runtime.challenge, question, action);
    reserved = true;
    if (action.kind === "answer") runtime.commit({ type: "draft", answer: action.answer });
    try {
      await runtime.run(spec.operation, spec.data, {
        channel: spec.channel,
        accept: (response, command) => {
          const outcome = normalizeInteraction(
            runtime.state().question ?? question,
            command,
            response,
          );
          if (outcome.kind === "progress")
            runtime.commit({
              type: "progress",
              question: outcome.question,
              selection: outcome.selection,
              message: outcome.message,
            });
          else {
            timeoutItemId = null;
            validationIntent = null;
            const reveal =
              runtime.challenge.mode === "pyramid" &&
              question.type === "mini-wordle" &&
              outcome.result.status === "correct";
            runtime.commit({
              type: "answer_accepted",
              result: outcome.result,
              question: outcome.question,
              phase: reveal ? "answer-reveal" : "transition",
            });
          }
        },
        after: async () => {
          if (runtime.state().phase === "transition" || runtime.state().phase === "answer-reveal")
            await lifecycle.afterAnswer();
          else await resumeTimeout();
        },
      });
    } finally {
      reserved = false;
      await resumeTimeout();
    }
  };
  const flushQueens = async () => {
    runtime.cancel("queens-draft");
    const state = runtime.state();
    if (state.question?.type !== "queens" || !latestQueens) return;
    const draft = latestQueens;
    latestQueens = null;
    if (draft.itemId !== state.question.id) return;
    const { queens } = draft;
    const question = state.question;
    const accepted = await runtime.run(
      "queensDraft",
      { challengeItemId: question.id, queens },
      {
        accept: (response, command) => {
          const outcome = normalizeInteraction(
            runtime.state().question ?? question,
            command,
            response,
          );
          if (outcome.kind === "progress")
            runtime.commit({ type: "progress", question: outcome.question });
        },
        after: async () => {
          await flushQueens();
          await resumeTimeout();
          if (
            validationIntent &&
            !validating &&
            runtime.state().phase === "playing" &&
            runtime.state().question?.id === validationIntent.itemId
          ) {
            await validateQueensBoard(validationIntent.queens);
          }
        },
      },
    );
    const pending = runtime.state().pendingCommand;
    const ownsDraft =
      pending?.operation === "queensDraft" &&
      pending.input.challengeItemId === draft.itemId &&
      pending.input.queens.length === queens.length &&
      pending.input.queens.every((cell, index) => cell === queens[index]);
    // Keep an unsent edit behind the uncertain command; the core owns its retry.
    if (
      !accepted &&
      !ownsDraft &&
      draft.revision === draftRevision &&
      runtime.state().question?.id === draft.itemId
    )
      latestQueens = draft;
  };
  const timeoutAnswer = async () => {
    const state = runtime.state();
    if (
      !state.question ||
      state.pendingCommand ||
      (runtime.challenge.mode === "narrative" && state.questionDeadlineAt === null)
    )
      return;
    validationIntent = null;
    await flushQueens();
    if (runtime.state().question?.id !== state.question.id) return;
    const draft = runtime.state().pendingAnswer;
    await interact(
      { kind: "answer", answer: supportsServerFlashDraft(state.question.type) ? draft : null },
      true,
    );
  };
  const onTimeUp = async (expectedItemId?: string) => {
    const state = runtime.state();
    if (!state.question || (state.phase !== "playing" && state.phase !== "checking")) return;
    if (
      runtime.challenge.mode !== "alphabet" &&
      expectedItemId &&
      state.question.id !== expectedItemId
    )
      return;
    if (
      runtime.challenge.mode === "narrative" &&
      (runtime.state().phase !== "playing" || runtime.state().questionDeadlineAt === null)
    )
      return;
    if (runtime.challenge.mode === "alphabet") {
      if (!alphabetTimeout.claim()) return;
    }
    if (reserved || runtime.state().pendingCommand) {
      timeoutItemId = runtime.state().question?.id ?? null;
      return;
    }
    await timeoutAnswer();
  };
  const validateQueensBoard = async (queens: readonly number[]) => {
    if (reserved || validating) return;
    const question = runtime.state().question;
    if (question?.type !== "queens") return;
    validationIntent = { itemId: question.id, queens: [...queens] };
    validating = true;
    try {
      latestQueens = { itemId: question.id, queens: [...queens], revision: ++draftRevision };
      await flushQueens();
      if (runtime.state().pendingCommand) return;
      validationIntent = null;
      if (runtime.state().question?.id === question.id)
        await interact({ kind: "queens-validation", queens });
    } finally {
      validating = false;
    }
  };
  lifecycle.setTimeoutAnswer(timeoutAnswer);
  return {
    submit: (answer: AnswerValue | null) => interact({ kind: "answer", answer }),
    submitMiniWordleGuess: (guess: string) => interact({ kind: "mini-wordle", guess }),
    submitLogicCodeAttempt: (code: string) => interact({ kind: "logic-code", code }),
    submitWordHashtagSwap: (fromCell: number, toCell: number) =>
      interact({ kind: "word-hashtag", fromCell, toCell }),
    revealProgressiveClue: () => interact({ kind: "reveal" }),
    submitWordSearchSelection: (startCell: number, endCell: number) =>
      interact({ kind: "word-search", startCell, endCell }),
    updateDraft: (answer: AnswerValue) => {
      const state = runtime.state();
      if (state.question && supportsServerFlashDraft(state.question.type) && !state.locked)
        runtime.commit({ type: "draft", answer });
    },
    updateQueensDraft: (queens: readonly number[]) => {
      const state = runtime.state();
      if (
        state.question?.type !== "queens" ||
        (state.pendingCommand && state.pendingCommand.operation !== "queensDraft") ||
        (state.locked && state.pendingCommand?.operation !== "queensDraft")
      )
        return;
      latestQueens = { itemId: state.question.id, queens: [...queens], revision: ++draftRevision };
      runtime.commit({ type: "draft", answer: { queens: [...queens], marks: [] } });
      runtime.schedule("queens-draft", 300, () => {
        void flushQueens();
      });
    },
    validateQueensBoard,
    onTimeUp,
    pass: async () => {
      const state = runtime.state();
      if (
        runtime.challenge.mode !== "alphabet" ||
        !state.question ||
        reserved ||
        state.pendingCommand ||
        state.locked
      )
        return;
      reserved = true;
      try {
        await runtime.run(
          "alphabetPass",
          { challengeItemId: state.question.id },
          {
            accept: () =>
              runtime.commit({ type: "phase", phase: "preparing", clearQuestion: true }),
            after: lifecycle.prepare,
          },
        );
      } finally {
        reserved = false;
      }
    },
  };
}
