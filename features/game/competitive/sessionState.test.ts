import { describe, expect, it } from "vitest";
import { initialServerFlashSessionState, serverFlashSessionReducer } from "./sessionState";

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
    let state = initialServerFlashSessionState("intro");

    state = serverFlashSessionReducer(state, {
      type: "start_succeeded",
      attempt,
      phase: "countdown",
    });
    state = serverFlashSessionReducer(state, {
      type: "answer_received",
      attempt,
      result,
    });
    expect(state).toMatchObject({
      phase: "transition",
      attempt,
      results: [result],
      lastResult: result,
    });

    state = serverFlashSessionReducer(state, {
      type: "transition_to_results",
      score: 10,
      reviewChallenge: null,
    });
    expect(state).toMatchObject({ phase: "results", score: 10, locked: true, busy: false });
  });

  it("keeps invalid or duplicated lifecycle events harmless and expires once", () => {
    const state = initialServerFlashSessionState("intro");
    const expired = serverFlashSessionReducer(state, { type: "expire_attempt" });
    const expiredAgain = serverFlashSessionReducer(expired, { type: "expire_attempt" });
    expect(expired).toEqual(expiredAgain);
    expect(expired).toMatchObject({
      phase: "results",
      attempt: null,
      question: null,
      attemptExpired: true,
      locked: true,
    });

    const stillIntro = serverFlashSessionReducer(state, {
      type: "set_start_notice",
      notice: "retry",
    });
    expect(stillIntro.phase).toBe("intro");
    expect(stillIntro.startNotice).toBe("retry");
  });
});
