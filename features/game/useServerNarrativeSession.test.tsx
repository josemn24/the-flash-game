// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { competitiveInputSource, competitiveQuestion } from "@/test-utils/competitiveInput";
import { competitiveRoomContext } from "@/test-utils/competitiveGameplay";
import type { Feedback } from "./competitive/core/sessionReducer";
import type { ServerNarrativeChallenge } from "@/types/gameplay/challenge";
import { useServerNarrativeSession } from "./useServerNarrativeSession";

const { useCore } = vi.hoisted(() => ({ useCore: vi.fn() }));
vi.mock("./competitive/core/useCompetitiveSession", () => ({ useCompetitiveSession: useCore }));
afterEach(cleanup);
const challenge: ServerNarrativeChallenge = {
  id: "narrative",
  definitionId: "narrative",
  mode: "narrative",
  number: 1,
  title: "Narrativa",
  subtitle: "",
  description: "",
  maxScore: 100,
  slots: [],
  prologue: { id: "opening", blocks: [] },
  beats: [],
};

describe("Narrative final input projection", () => {
  it.each([
    { channel: "answerVerification", state: "submitting", visible: false },
    {
      channel: "answerVerification",
      state: "error",
      visible: true,
      message: "Respuesta pendiente de confirmar",
    },
    { channel: "reveal", state: "error", visible: true, message: "Fallo de pista" },
  ] satisfies Feedback[])("adapts $channel/$state before building renderer props", (feedback) => {
    const retrySubmit = vi.fn();
    const core = {
      ...competitiveInputSource({
        question: competitiveQuestion("progressive-clues"),
        retrySubmit,
        revealState: "error",
        revealError: "Fallo de pista",
      }),
      feedback,
      phase: "playing",
      stepIndex: 0,
    };
    useCore.mockReturnValue(core);
    const { result } = renderHook(() =>
      useServerNarrativeSession({ challenge, roomContext: competitiveRoomContext }),
    );
    const input = result.current.questionInput;
    if (input?.format !== "progressive-clues") throw new Error("Missing clue input");
    expect(input.props.submissionState).toBe(
      feedback.channel === "answerVerification" ? feedback.state : "idle",
    );
    expect(input.props.submissionStatusVisible).toBe(
      feedback.channel === "answerVerification" ? feedback.visible : false,
    );
    expect(input.props.submissionError).toBe(
      feedback.channel === "answerVerification" ? feedback.message : undefined,
    );
    expect(input.props.revealError).toBe("Fallo de pista");
    input.props.onRetrySubmission?.();
    expect(retrySubmit).toHaveBeenCalledOnce();
    expect(result.current.currentStep).toEqual({ type: "scene", scene: challenge.prologue });
  });
});
