import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import { reviewFor } from "../modes/policy";
import { createAdvancement } from "./advance";
import { preparedEvent, timestamp } from "./projection";
import type { SessionRuntime } from "./runtime";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
import type { PendingCommand } from "./sessionReducer";

export function createAttemptLifecycle(runtime: SessionRuntime) {
  let finalizationRequested = false;
  const finalization = runtime.policy.finalization;
  const requestFinalization = () => {
    finalizationRequested = true;
    runtime.cancel("advance");
  };
  const finish = (
    response: AuthoritativeSessionUpdate,
    terminalReview?: readonly ServerFlashTerminalReview[],
  ) => {
    if (typeof response.score !== "number" || !Number.isFinite(response.score))
      throw new Error("invalid_completion_response");
    let review: ReturnType<typeof reviewFor> = null;
    let reviewPending = response.reviewPending === true;
    try {
      review = reviewFor(runtime.challenge, terminalReview ?? []);
    } catch {
      reviewPending = true;
    }
    const permissionRevoked = response.terminalReason === "permission_revoked";
    runtime.cancelAll();
    runtime.commit({
      type: "completed",
      score: permissionRevoked ? 0 : response.score,
      reviewChallenge: reviewPending ? null : review,
      reviewPending,
      terminalReason:
        typeof response.terminalReason === "string" ? response.terminalReason : undefined,
      ...(Array.isArray(response.answers) ? { results: [...(response.answers ?? [])] } : {}),
    });
  };
  const complete = async (deadline = false) => {
    if (finalization.globalClock) {
      requestFinalization();
      runtime.commit({ type: "phase", phase: "finalizing" });
    }
    const step = {
      accept: (
        response: AuthoritativeSessionUpdate,
        _command: PendingCommand<"complete">,
        review?: readonly ServerFlashTerminalReview[],
      ) => finish(response, review),
    };
    if (deadline) await runtime.runDeadline("complete", {}, step);
    else await runtime.run("complete", {}, step);
  };
  const finalizeGlobalClock = async () => {
    requestFinalization();
    const state = runtime.state();
    // Keep the outstanding answer/pass until it is accepted or reconciled.
    if (state.phase === "results" || state.phase === "review" || state.attemptExpired) return;
    if (
      state.busy ||
      (state.pendingCommand &&
        state.pendingCommand.operation !== "queensDraft" &&
        state.pendingCommand.operation !== "connectPairsDraft")
    ) {
      runtime.commit({ type: "phase", phase: "finalizing" });
      return;
    }
    await complete(true);
  };
  let timeoutAnswer: () => Promise<void> = async () => {};
  const prepare = async () => {
    let timedOut = false;
    await runtime.run(
      "prepare",
      {},
      {
        accept: (response) => {
          runtime.commit(preparedEvent(runtime, response));
          timedOut =
            response.timedOut === true && (finalization.globalClock || response.deadlineAt != null);
        },
        after: async () => {
          if (finalization.onProgress(finalizationRequested, timedOut) === "finalize")
            await finalizeGlobalClock();
          else if (timedOut) await timeoutAnswer();
        },
      },
    );
  };
  const advance = createAdvancement(runtime, prepare, complete);
  const recoverCurrent = async () => {
    let snapshot: AuthoritativeSessionUpdate | undefined;
    await runtime.run(
      "recover",
      {},
      {
        accept: (response, _command, review) => {
          snapshot = response;
          const attempt = runtime.state().attempt!;
          runtime.commit({
            type: "recovered",
            attempt: { id: attempt.id, revision: Number(response.revision) },
            results: [...(response.answers ?? [])],
          });
          if (response.phase === "results") finish(response, review);
        },
        after: async () => {
          if (!snapshot || snapshot.phase === "results") return;
          if (finalization.onProgress(finalizationRequested) === "finalize") {
            await finalizeGlobalClock();
            return;
          }
          if (snapshot.resolved) {
            const resolved = snapshot.resolved;
            const position = runtime.policy.position(String(resolved.challengeItemId));
            runtime.commit({
              type: "phase",
              phase: "transition",
              ...(runtime.challenge.mode === "narrative"
                ? { stepIndex: position }
                : { questionIndex: position }),
            });
            runtime.schedule("advance", runtime.challenge.mode === "narrative" ? 300 : 900, () => {
              void advance.next();
            });
          } else await advance.apply(runtime.policy.recover(runtime.state(), snapshot));
        },
      },
    );
  };
  const begin = async () => {
    if (runtime.state().busy || runtime.state().pendingCommand) return;
    if (runtime.challenge.mode === "time-trial") {
      runtime.commit({ type: "phase", phase: "countdown", clearQuestion: true });
      return;
    }
    await runtime.run(
      "prepareSession",
      { challengeId: runtime.challenge.id },
      {
        accept: () => {},
        after: async () => {
          await runtime.run(
            "start",
            { challengeId: runtime.challenge.id },
            {
              accept: () =>
                runtime.commit({
                  type: "phase",
                  phase: runtime.policy.initialPhase,
                  stepIndex: 0,
                  clearQuestion: true,
                }),
            },
          );
        },
      },
    );
  };
  const recover = async () => {
    runtime.cancelAll();
    runtime.commit({ type: "phase", phase: "recovering" });
    // Start restores the session cookie and obtains the current authoritative version.
    await runtime.run(
      "prepareSession",
      { challengeId: runtime.challenge.id },
      {
        accept: () => {},
        after: async () => {
          await runtime.run(
            "start",
            { challengeId: runtime.challenge.id },
            {
              accept: (response) => {
                const deadline =
                  finalization.recoveryDeadline === "session"
                    ? runtime.state().deadlineAt
                    : timestamp(response.deadlineAt);
                if (finalization.globalClock && deadline !== null && deadline <= runtime.now()) {
                  requestFinalization();
                  runtime.commit({ type: "phase", phase: "finalizing" });
                }
              },
              after: async () => {
                await recoverCurrent();
              },
            },
          );
        },
      },
    );
  };
  const recoverTransferred = async () => {
    runtime.cancelAll();
    runtime.commit({ type: "phase", phase: "recovering" });
    await recoverCurrent();
  };
  const recoverTerminal = async () => {
    let terminal = false;
    const accepted = await runtime.run(
      "recover",
      {},
      {
        accept: (response, _command, review) => {
          if (response.phase !== "results" && response.status !== "abandoned")
            throw new Error("terminal_recovery_not_terminal");
          terminal = true;
          finish(response, review);
        },
      },
    );
    return accepted && terminal;
  };
  const activate = async () => {
    const state = runtime.state();
    if (
      runtime.challenge.mode !== "pyramid" ||
      state.phase !== "preparing" ||
      !state.question ||
      state.pendingCommand ||
      state.questionDeadlineAt !== null
    )
      return;
    let timedOut = false;
    await runtime.run(
      "activate",
      { challengeItemId: state.question.id },
      {
        accept: (response) => {
          timedOut = response.timedOut === true;
          const presentedAt = timestamp(response.presentedAt);
          const deadlineAt = timestamp(response.deadlineAt);
          if (presentedAt === null || deadlineAt === null)
            throw new Error("invalid_activation_deadline");
          runtime.commit({
            type: "prepared",
            attempt: { id: runtime.state().attempt!.id, revision: Number(response.revision) },
            question: state.question,
            questionIndex: state.questionIndex,
            stepIndex: state.stepIndex,
            presentedAt,
            deadlineAt,
            phase: "playing",
            locked: response.timedOut === true,
          });
        },
        after: async () => {
          if (timedOut) await timeoutAnswer();
        },
      },
    );
  };
  const startTimeTrial = async () => {
    await runtime.run(
      "prepareSession",
      { challengeId: runtime.challenge.id },
      {
        accept: () => {},
        after: async () => {
          let resumed = false;
          await runtime.run(
            "start",
            { challengeId: runtime.challenge.id },
            {
              accept: (response) => {
                resumed = response.resumed === true;
                runtime.commit({ type: "phase", phase: "preparing", clearQuestion: true });
              },
              after: async () => {
                if (resumed) await recoverCurrent();
                else await prepare();
              },
            },
          );
        },
      },
    );
  };
  return {
    startTimeTrial,
    reloadResult: () =>
      runtime.run(
        "recover",
        {},
        { accept: (response, _command, review) => finish(response, review) },
      ),
    begin,
    prepare,
    complete,
    finalizeGlobalClock,
    finalizationRequested: () => finalizationRequested,
    recover,
    recoverTransferred,
    recoverTerminal,
    activate,
    ...advance,
    setTimeoutAnswer: (answer: () => Promise<void>) => {
      timeoutAnswer = answer;
    },
  };
}
