import { describe, expect, it } from "vitest";
import { initialSessionState, sessionReducer } from "./core/sessionReducer";

describe("server flash session reducer", () => {
  it("exposes the transport lifecycle without changing the domain attempt status", () => {
    const command = {
      operation: "answer" as const,
      input: {
        attemptId: "attempt-1",
        lockVersion: 2,
        challengeItemId: "question-1",
        answer: "A" as const,
        idempotencyKey: "answer-1",
      },
    };
    const initial = initialSessionState("playing");
    expect(initial.commandStatus).toBe("idle");

    const submitting = sessionReducer(initial, { type: "command_started", command });
    expect(submitting.commandStatus).toBe("submitting");

    const uncertain = sessionReducer(submitting, {
      type: "command_failed",
      definitive: false,
      lifecycleError: { operation: "answer", message: "No confirmado" },
    });
    expect(uncertain.commandStatus).toBe("uncertain");
    expect(uncertain.pendingCommand).toEqual(command);
    expect(uncertain.locked).toBe(true);

    const reconciled = sessionReducer(uncertain, {
      type: "phase",
      phase: "recovering",
    });
    expect(reconciled.commandStatus).toBe("reconciling");

    const confirmed = sessionReducer(reconciled, {
      type: "recovered",
      attempt: { id: "attempt-1", lockVersion: 3 },
      results: [],
    });
    expect(confirmed.commandStatus).toBe("confirmed");

    const failed = sessionReducer(submitting, {
      type: "command_failed",
      definitive: true,
      lifecycleError: { operation: "answer", message: "Datos no válidos" },
    });
    expect(failed.commandStatus).toBe("definitive_failure");
    expect(failed.pendingCommand).toBeNull();
  });

  it("handles start, answer, transition and terminal result events", () => {
    const attempt = { id: "attempt-1", lockVersion: 2 };
    const result = {
      questionId: "question-1",
      answer: "A",
      status: "correct" as const,
      isCorrect: true,
      points: 10,
      timeUsed: 1.2,
    };
    let state = initialSessionState("intro");

    state = sessionReducer(state, {
      type: "command_succeeded",
      attempt,
    });
    state = sessionReducer(state, {
      type: "answer_accepted",
      phase: "transition",
      result,
    });
    expect(state).toMatchObject({
      phase: "transition",
      attempt,
      results: [result],
      lastResult: result,
    });

    state = sessionReducer(state, {
      type: "completed",
      score: 10,
      reviewChallenge: null,
    });
    expect(state).toMatchObject({ phase: "results", score: 10, locked: true, busy: false });
  });

  it("keeps invalid or duplicated lifecycle events harmless and expires once", () => {
    const state = initialSessionState("intro");
    const expired = sessionReducer(state, { type: "expired" });
    const expiredAgain = sessionReducer(expired, { type: "expired" });
    expect(expired).toEqual(expiredAgain);
    expect(expired).toMatchObject({
      phase: "results",
      attempt: null,
      question: null,
      attemptExpired: true,
      locked: true,
    });

    const stillIntro = sessionReducer(state, {
      type: "command_failed",
      notice: "retry",
    });
    expect(stillIntro.phase).toBe("intro");
    expect(stillIntro.startNotice).toBe("retry");
  });
});
