import { createAlphabetTimeoutGuard } from "../../alphabetTimeoutGuard";
import { isDraftCommand } from "./checkpoints";
import {
  isPyramidDraftAnswer,
  isPyramidDraftFormat,
  pyramidPartialCreditEnabled,
} from "@/lib/gameplay/pyramidPartialCredit";
import type { PyramidDraftAnswer } from "@/types/contracts/game-session";
import type { AnswerValue } from "@/types/contracts";
import { supportsServerFlashDraft } from "../formats/generic";
import { interactionFor, normalizeInteraction } from "../formats/adapter";
import type { FormatAction } from "../formats/types";
import type { CommandStep, SessionRuntime } from "./runtime";
import type { createAttemptLifecycle } from "./attemptLifecycle";
export function createInteractions(
  runtime: SessionRuntime,
  lifecycle: ReturnType<typeof createAttemptLifecycle>,
) {
  let reserved = false;
  let validating = false;
  const globalTimeout = createAlphabetTimeoutGuard();
  const finalization = runtime.policy.finalization;
  let timeoutItemId: string | null = null;
  let draftRevision = 0;
  let lastQueensCheckpointAt: number | null = null;
  let lastDraftCheckpointAt: number | null = null;
  let firstQueensEditAt: number | null = null;
  let firstDraftEditAt: number | null = null;
  let queensCheckpointScheduled = false;
  let draftCheckpointScheduled = false;
  let latestQueens: { itemId: string; queens: readonly number[]; revision: number } | null = null;
  let latestDraft: {
    itemId: string;
    revision: number;
    payload:
      | { operation: "connectPairsDraft"; paths: Readonly<Record<string, readonly number[]>> }
      | { operation: "pyramidDraft"; answer: PyramidDraftAnswer };
  } | null = null;
  const usesPyramidDraft = (type: string) =>
    runtime.challenge.mode === "pyramid" &&
    isPyramidDraftFormat(type) &&
    pyramidPartialCreditEnabled(runtime.challenge, type);
  let validationIntent: { itemId: string; queens: readonly number[] } | null = null;
  const checkpointDelay = (lastCheckpointAt: number | null, firstEditAt: number | null) => {
    if (lastCheckpointAt === null)
      return Math.max(0, 300 - (runtime.now() - (firstEditAt ?? runtime.now())));
    return Math.max(300, 1_000 - (runtime.now() - lastCheckpointAt));
  };
  const scheduleQueensCheckpoint = () => {
    if (queensCheckpointScheduled) return;
    queensCheckpointScheduled = true;
    runtime.schedule(
      "queens-draft",
      checkpointDelay(lastQueensCheckpointAt, firstQueensEditAt),
      () => {
        queensCheckpointScheduled = false;
        void flushQueens();
      },
    );
  };
  const scheduleDraftCheckpoint = () => {
    if (draftCheckpointScheduled) return;
    draftCheckpointScheduled = true;
    runtime.schedule(
      "answer-draft",
      checkpointDelay(lastDraftCheckpointAt, firstDraftEditAt),
      () => {
        draftCheckpointScheduled = false;
        void flushDraft();
      },
    );
  };
  const cancelQueensCheckpoint = () => {
    runtime.cancel("queens-draft");
    queensCheckpointScheduled = false;
  };
  const cancelDraftCheckpoint = () => {
    runtime.cancel("answer-draft");
    draftCheckpointScheduled = false;
  };
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
  const interact = async (action: FormatAction, force = false, deadline = false) => {
    const state = runtime.state();
    const question = state.question;
    if (
      !question ||
      state.attemptExpired ||
      (!force && (reserved || state.locked || state.phase !== "playing"))
    )
      return false;
    const pendingOperation = state.pendingCommand?.operation;
    const pendingCheckpoint = isDraftCommand(pendingOperation);
    const draftAnswer =
      action.kind === "answer" &&
      (question.type === "connect-pairs" || usesPyramidDraft(question.type));
    const authoritativeAction = draftAnswer || action.kind === "queens-validation";
    if (draftAnswer) {
      cancelDraftCheckpoint();
      latestDraft = null;
      firstDraftEditAt = null;
    }
    if (state.pendingCommand && !deadline) {
      if (pendingCheckpoint && authoritativeAction) {
        if (action.kind === "queens-validation") {
          cancelQueensCheckpoint();
          latestQueens = null;
          firstQueensEditAt = null;
        }
      } else {
        return false;
      }
    }
    if (state.pendingCommand && (!pendingCheckpoint || (!deadline && !authoritativeAction)))
      return false;
    // An overtaken flush must not restore its old board after validation returns.
    if (authoritativeAction || deadline) draftRevision++;
    const spec = interactionFor(runtime.challenge, question, action);
    reserved = true;
    if (action.kind === "answer") runtime.commit({ type: "draft", answer: action.answer });
    try {
      const step: CommandStep = {
        channel: spec.channel,
        accept: (response, command) => {
          if (command.operation === "queensValidation") validationIntent = null;
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
            cancelDraftCheckpoint();
            latestDraft = null;
            timeoutItemId = null;
            validationIntent = null;
            const reveal =
              runtime.challenge.mode === "pyramid" &&
              question.type === "mini-wordle" &&
              outcome.result.status === "correct";
            runtime.commit({
              type: "answer_accepted",
              result:
                usesPyramidDraft(question.type) && response.timedOut
                  ? { ...outcome.result, answer: null }
                  : outcome.result,
              question: outcome.question,
              phase: reveal ? "answer-reveal" : "transition",
            });
          }
        },
        after: async () => {
          if (finalization.onProgress(lifecycle.finalizationRequested()) === "finalize")
            await lifecycle.finalizeGlobalClock();
          else if (
            runtime.state().phase === "transition" ||
            runtime.state().phase === "answer-reveal"
          )
            await lifecycle.afterAnswer();
          else await resumeTimeout();
        },
      };
      const accepted = deadline
        ? await runtime.runDeadline(spec.operation, spec.data, step)
        : pendingCheckpoint && authoritativeAction
          ? await runtime.runOvertakingDraft(spec.operation, spec.data, step)
          : await runtime.run(spec.operation, spec.data, step);
      return accepted;
    } finally {
      reserved = false;
      await resumeTimeout();
    }
  };
  const flushQueens = async () => {
    cancelQueensCheckpoint();
    const state = runtime.state();
    if (state.pendingCommand) return;
    if (state.question?.type !== "queens" || !latestQueens) return;
    const draft = latestQueens;
    latestQueens = null;
    if (draft.itemId !== state.question.id) return;
    const { queens } = draft;
    const question = state.question;
    lastQueensCheckpointAt = runtime.now();
    firstQueensEditAt = null;
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
            runtime.commit({
              type: "progress",
              question: outcome.question,
              keepLocked: validationIntent !== null,
            });
        },
        after: async () => {
          await resumeTimeout();
          if (latestQueens && !validationIntent) scheduleQueensCheckpoint();
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
      runtime.state().pendingCommand?.operation === "queensDraft" &&
      draft.revision === draftRevision &&
      runtime.state().question?.id === draft.itemId
    ) {
      latestQueens = draft;
      scheduleQueensCheckpoint();
    }
  };
  const flushDraft = async () => {
    cancelDraftCheckpoint();
    const state = runtime.state();
    if (state.pendingCommand) return;
    if (!state.question || state.phase !== "playing" || state.locked || !latestDraft) return;
    const draft = latestDraft;
    latestDraft = null;
    if (draft.itemId !== state.question.id) return;
    const question = state.question;
    lastDraftCheckpointAt = runtime.now();
    firstDraftEditAt = null;
    const step: CommandStep<"connectPairsDraft" | "pyramidDraft"> = {
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
        await resumeTimeout();
        if (latestDraft) scheduleDraftCheckpoint();
      },
    };
    const { payload } = draft;
    const accepted =
      payload.operation === "connectPairsDraft"
        ? await runtime.run<"connectPairsDraft">(
            "connectPairsDraft",
            { challengeItemId: question.id, paths: payload.paths },
            step,
          )
        : await runtime.run<"pyramidDraft">(
            "pyramidDraft",
            { challengeItemId: question.id, answer: payload.answer },
            step,
          );
    const pending = runtime.state().pendingCommand;
    const ownsDraft =
      (pending?.operation === "connectPairsDraft" &&
        pending.input.challengeItemId === draft.itemId &&
        payload.operation === "connectPairsDraft" &&
        JSON.stringify(pending.input.paths) === JSON.stringify(payload.paths)) ||
      (pending?.operation === "pyramidDraft" &&
        pending.input.challengeItemId === draft.itemId &&
        payload.operation === "pyramidDraft" &&
        JSON.stringify(pending.input.answer) === JSON.stringify(payload.answer));
    if (
      !accepted &&
      !ownsDraft &&
      runtime.state().pendingCommand?.operation === payload.operation &&
      draft.revision === draftRevision &&
      runtime.state().question?.id === draft.itemId
    ) {
      latestDraft = draft;
      scheduleDraftCheckpoint();
    }
  };
  const timeoutAnswer = async () => {
    const state = runtime.state();
    if (
      !state.question ||
      (state.pendingCommand && !isDraftCommand(state.pendingCommand.operation)) ||
      (runtime.challenge.mode === "narrative" && state.questionDeadlineAt === null)
    )
      return;
    validationIntent = null;
    cancelQueensCheckpoint();
    cancelDraftCheckpoint();
    latestQueens = null;
    latestDraft = null;
    firstQueensEditAt = null;
    firstDraftEditAt = null;
    if (runtime.state().question?.id !== state.question.id) return;
    const draft = runtime.state().pendingAnswer;
    await interact(
      {
        kind: "answer",
        answer:
          !usesPyramidDraft(state.question.type) && supportsServerFlashDraft(state.question.type)
            ? draft
            : null,
      },
      true,
      true,
    );
  };
  const onTimeUp = async (expectedItemId?: string) => {
    const state = runtime.state();
    const decision = finalization.onTimeout(state);
    if (decision === "ignore") return;
    if (decision === "finalize") {
      if (!globalTimeout.claim()) return;
      draftRevision++;
      cancelQueensCheckpoint();
      cancelDraftCheckpoint();
      latestQueens = null;
      latestDraft = null;
      firstQueensEditAt = null;
      firstDraftEditAt = null;
      await lifecycle.finalizeGlobalClock();
      return;
    }
    if (!state.question || (state.phase !== "playing" && state.phase !== "checking")) return;
    if (expectedItemId && state.question.id !== expectedItemId) return;
    if (
      runtime.challenge.mode === "narrative" &&
      (runtime.state().phase !== "playing" || runtime.state().questionDeadlineAt === null)
    )
      return;
    const pending = runtime.state().pendingCommand;
    if (reserved || (pending && !isDraftCommand(pending.operation))) {
      timeoutItemId = runtime.state().question?.id ?? null;
      return;
    }
    await timeoutAnswer();
  };
  const validateQueensBoard = async (queens: readonly number[]) => {
    if (reserved || validating) return;
    const state = runtime.state();
    const question = state.question;
    if (
      question?.type !== "queens" ||
      state.phase !== "playing" ||
      state.attemptExpired ||
      (state.locked && !validationIntent && state.pendingCommand?.operation !== "queensDraft")
    )
      return;
    validationIntent = { itemId: question.id, queens: [...queens] };
    // Reserve the board before awaiting draft persistence, not only the validation request.
    runtime.commit({ type: "queens_validation_requested" });
    validating = true;
    try {
      cancelQueensCheckpoint();
      latestQueens = null;
      firstQueensEditAt = null;
      if (
        runtime.state().question?.id === question.id &&
        runtime.state().phase === "playing" &&
        !runtime.state().attemptExpired
      ) {
        const accepted = await interact({ kind: "queens-validation", queens }, true);
        if (!accepted && !runtime.state().pendingCommand) validationIntent = null;
      }
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
      const { question, locked } = runtime.state();
      if (!question || locked) return;
      if (supportsServerFlashDraft(question.type) || usesPyramidDraft(question.type))
        runtime.commit({ type: "draft", answer });
      let payload: NonNullable<typeof latestDraft>["payload"];
      if (question.type === "connect-pairs") {
        const paths = (answer as { paths?: Readonly<Record<string, readonly number[]>> }).paths;
        if (!paths || typeof paths !== "object" || Array.isArray(paths)) return;
        payload = { operation: "connectPairsDraft", paths: structuredClone(paths) };
        runtime.commit({ type: "draft", answer });
      } else if (usesPyramidDraft(question.type) && isPyramidDraftAnswer(answer)) {
        payload = { operation: "pyramidDraft", answer: structuredClone(answer) };
      } else return;
      latestDraft = { itemId: question.id, payload, revision: ++draftRevision };
      firstDraftEditAt ??= runtime.now();
      scheduleDraftCheckpoint();
    },
    updateQueensDraft: (queens: readonly number[]) => {
      const state = runtime.state();
      if (
        state.question?.type !== "queens" ||
        validationIntent !== null ||
        (state.pendingCommand && state.pendingCommand.operation !== "queensDraft") ||
        (state.locked && state.pendingCommand?.operation !== "queensDraft")
      )
        return;
      latestQueens = { itemId: state.question.id, queens: [...queens], revision: ++draftRevision };
      firstQueensEditAt ??= runtime.now();
      runtime.commit({ type: "draft", answer: { queens: [...queens], marks: [] } });
      scheduleQueensCheckpoint();
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
            after: async () => {
              if (finalization.onProgress(lifecycle.finalizationRequested()) === "finalize")
                await lifecycle.finalizeGlobalClock();
              else await lifecycle.prepare();
            },
          },
        );
      } finally {
        reserved = false;
      }
    },
  };
}
