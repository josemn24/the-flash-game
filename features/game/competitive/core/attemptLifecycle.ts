import { terminalReviewFromResponse } from "../../serverFlashQuestionAdapter";
import { reviewFor } from "../modes/policy";
import { createAdvancement } from "./advance";
import { preparedEvent, recoveredResults, timestamp } from "./projection";
import type { SessionRuntime } from "./runtime";
import type { CompetitiveJsonObject } from "../transport";

export function createAttemptLifecycle(runtime: SessionRuntime) {
  let finalizationRequested = false;
  const finish = (response: CompetitiveJsonObject) => {
    const review = reviewFor(runtime.challenge, terminalReviewFromResponse(response.review));
    const permissionRevoked = response.terminalReason === "permission_revoked";
    runtime.cancelAll();
    runtime.commit({
      type: "completed",
      score: permissionRevoked
        ? 0
        : Number(
            response.score ??
              runtime.state().results.reduce((sum, result) => sum + result.points, 0),
          ),
      reviewChallenge: response.reviewPending ? null : review,
      reviewPending: response.reviewPending === true,
      terminalReason:
        typeof response.terminalReason === "string" ? response.terminalReason : undefined,
      ...(Array.isArray(response.answers) ? { results: recoveredResults(response.answers) } : {}),
    });
  };
  const complete = async () => {
    if (runtime.challenge.mode === "alphabet") {
      finalizationRequested = true;
      runtime.commit({ type: "phase", phase: "finalizing" });
    }
    await runtime.run("complete", {}, { accept: finish });
  };
  const finalizeAlphabet = async () => {
    finalizationRequested = true;
    const state = runtime.state();
    // Keep the outstanding answer/pass until it is accepted or reconciled.
    if (state.phase === "results" || state.phase === "review" || state.attemptExpired) return;
    if (state.busy || state.pendingCommand) {
      runtime.commit({ type: "phase", phase: "finalizing" });
      return;
    }
    await complete();
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
            response.timedOut === true &&
            (runtime.challenge.mode === "alphabet" || response.deadlineAt != null);
        },
        after: async () => {
          if (runtime.challenge.mode === "alphabet" && (timedOut || finalizationRequested))
            await finalizeAlphabet();
          else if (timedOut) await timeoutAnswer();
        },
      },
    );
  };
  const advance = createAdvancement(runtime, prepare, complete);
  const recoverCurrent = async () => {
    let snapshot: CompetitiveJsonObject | undefined;
    await runtime.run(
      "recover",
      {},
      {
        accept: (response) => {
          snapshot = response;
          const attempt = runtime.state().attempt!;
          runtime.commit({
            type: "recovered",
            attempt: { id: attempt.id, lockVersion: Number(response.lockVersion) },
            results: recoveredResults(response.answers),
          });
          if (response.phase === "results") finish(response);
        },
        after: async () => {
          if (!snapshot || snapshot.phase === "results") return;
          if (runtime.challenge.mode === "alphabet" && finalizationRequested) {
            await finalizeAlphabet();
            return;
          }
          if (snapshot.resolved) {
            const resolved = snapshot.resolved as CompetitiveJsonObject;
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
    await runtime.run(
      "prepareSession",
      { scheduledChallengeId: runtime.challenge.id },
      {
        accept: () => {},
        after: async () => {
          await runtime.run(
            "start",
            { scheduledChallengeId: runtime.challenge.id },
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
      { scheduledChallengeId: runtime.challenge.id },
      {
        accept: () => {},
        after: async () => {
          await runtime.run(
            "start",
            { scheduledChallengeId: runtime.challenge.id },
            {
              accept: (response) => {
                const deadline = timestamp(response.deadlineAt);
                if (
                  runtime.challenge.mode === "alphabet" &&
                  deadline !== null &&
                  deadline <= Date.now()
                ) {
                  finalizationRequested = true;
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
        accept: (response) => {
          if (response.phase !== "results" && response.status !== "abandoned")
            throw new Error("terminal_recovery_not_terminal");
          terminal = true;
          finish(response);
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
            attempt: { id: runtime.state().attempt!.id, lockVersion: Number(response.lockVersion) },
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
  return {
    reloadResult: () => runtime.run("recover", {}, { accept: finish }),
    begin,
    prepare,
    complete,
    finalizeAlphabet,
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
