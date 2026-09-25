import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/test-utils/mockGameplay";
import {
  FlashQuestionStage,
  SurvivalQuestionStage,
} from "@/components/game/shared/QuestionStagePresets";
import { isDelayedQuestionTimer } from "@/features/game/useQuestionStageTimer";

const noop = () => {};

function stageProps(
  question: Pick<
    Parameters<typeof FlashQuestionStage>[0],
    "question" | "questionNumber" | "totalQuestions" | "locked"
  >,
) {
  return {
    ...question,
    onSubmit: noop,
    onTimeUp: noop,
    onCodeAttempt: () => false,
    onProgress: noop,
    onIncorrectAttempt: noop,
    onProgressiveClueReveal: noop,
    onTimedResponseStart: noop,
    codeAttemptCount: 0,
  };
}

describe("QuestionStage", () => {
  it("renders one progress indicator in the shared header with an accessible title", () => {
    const challenge = getChallengeById("tabarnia-flash-01");
    if (!challenge || challenge.mode !== "flash") throw new Error("Expected flash challenge");

    const markup = renderToStaticMarkup(
      <FlashQuestionStage
        {...stageProps({
          question: challenge.questions[0],
          questionNumber: 1,
          totalQuestions: challenge.questions.length,
          locked: false,
        })}
      />,
    );

    expect(markup.match(/Pregunta 01/g)).toHaveLength(1);
    expect(markup).toContain('role="timer"');
    expect(markup).toContain('aria-labelledby="');
    expect(markup).toContain(challenge.questions[0].question);
  });

  it("keeps mode-specific header actions in the preset wrapper", () => {
    const challenge = getChallengeById("tabarnia-challenge-03");
    if (!challenge || challenge.mode !== "survival") throw new Error("Expected survival challenge");

    const markup = renderToStaticMarkup(
      <SurvivalQuestionStage
        {...stageProps({
          question: challenge.questions[0],
          questionNumber: 1,
          totalQuestions: challenge.questions.length,
          locked: false,
        })}
        livesRemaining={2}
        totalLives={3}
      />,
    );

    expect(markup.match(/Pregunta 01/g)).toHaveLength(1);
    expect(markup).toContain("2 de 3 vidas restantes");
  });

  it("identifies every format that starts its timer after presentation", () => {
    expect(isDelayedQuestionTimer({ type: "flash-memory" })).toBe(true);
    expect(isDelayedQuestionTimer({ type: "simon-sequence" })).toBe(true);
    expect(isDelayedQuestionTimer({ type: "mini-wordle" })).toBe(true);
    expect(isDelayedQuestionTimer({ type: "progressive-image" })).toBe(true);
    expect(isDelayedQuestionTimer({ type: "multiple-choice" })).toBe(false);
  });
});
