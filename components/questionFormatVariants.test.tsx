import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnswerOption } from "@/components/AnswerOption";
import { TrueFalseQuestion } from "@/components/TrueFalseQuestion";
import { getChallengeById } from "@/data/challenges";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import type { AnswerValue, Question, QuestionVariant } from "@/types/game";

const migratedTypes = new Set([
  "multiple-choice",
  "true-false",
  "odd-one-out",
  "matching",
  "ordering",
  "progressive-image",
  "heat-map",
  "estimation",
  "classification",
  "anagram",
]);

function renderQuestion(question: Question, variant: QuestionVariant) {
  return renderToStaticMarkup(
    <QuestionInput
      question={question}
      variant={variant}
      locked={false}
      onSubmit={vi.fn()}
      codeAttemptCount={0}
      onCodeAttempt={vi.fn(() => false)}
      onProgress={vi.fn()}
      onIncorrectAttempt={vi.fn()}
      onProgressiveClueReveal={vi.fn()}
      onTimedResponseStart={vi.fn()}
    />,
  );
}

describe("question format visual variants", () => {
  it("forwards default and Flash Pop variants to all ten migrated formats", () => {
    const challenge = getChallengeById("tabarnia-flash-01");
    if (challenge?.mode !== "flash") throw new Error("Expected flash challenge");

    const questions = challenge.questions.filter((question) => migratedTypes.has(question.type));
    expect(questions).toHaveLength(16);

    questions.forEach((question) => {
      const defaultMarkup = renderQuestion(question, "default");
      const popMarkup = renderQuestion(question, "flash-pop");
      expect(defaultMarkup).toContain('data-variant="default"');
      expect(popMarkup).toContain('data-variant="flash-pop"');
      expect(popMarkup).not.toEqual(defaultMarkup);
    });
  });

  it("keeps AnswerOption and true/false submissions intact across variants", () => {
    const answers: AnswerValue[] = [];
    const option = AnswerOption({
      label: "Opción A",
      index: 0,
      disabled: false,
      onSelect: () => answers.push("Opción A"),
      variant: "flash-pop",
    }) as React.ReactElement<{ onClick: () => void }>;
    option.props.onClick();

    const trueFalse = TrueFalseQuestion({
      locked: false,
      onSubmit: (answer) => answers.push(answer),
      variant: "flash-pop",
    }) as React.ReactElement<{ children: React.ReactElement[] }>;
    const buttons = trueFalse.props.children as React.ReactElement<{ onClick: () => void }>[];
    buttons[0].props.onClick();
    buttons[1].props.onClick();

    expect(answers).toEqual(["Opción A", true, false]);
  });

  it("renders migrated controls disabled when the session is locked", () => {
    const challenge = getChallengeById("tabarnia-flash-01");
    if (challenge?.mode !== "flash") throw new Error("Expected flash challenge");

    const questions = challenge.questions.filter((question) => migratedTypes.has(question.type));
    questions.forEach((question) => {
      const markup = renderToStaticMarkup(
        <QuestionInput
          question={question}
          variant="flash-pop"
          locked
          onSubmit={vi.fn()}
          codeAttemptCount={0}
          onCodeAttempt={vi.fn(() => false)}
          onProgress={vi.fn()}
          onIncorrectAttempt={vi.fn()}
          onProgressiveClueReveal={vi.fn()}
          onTimedResponseStart={vi.fn()}
        />,
      );
      expect(markup).toContain("disabled");
    });
  });
});
