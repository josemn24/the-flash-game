import { describe, expect, it } from "vitest";
import { initialSessionState, sessionReducer } from "./core/sessionReducer";

describe("server flash session reducer", () => {
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
