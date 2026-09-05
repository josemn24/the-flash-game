import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnswerOption } from "@/components/questions/shared/AnswerOption";
import { TrueFalseQuestion } from "@/components/questions/formats/true-false/TrueFalseQuestion";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
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
  "connect-pairs",
  "progressive-clues",
  "logic-matrix",
  "queens",
  "logic-code",
  "word-hashtag",
  "word-search",
  "mini-wordle",
  "short-text",
  "image-labeling",
  "flash-memory",
  "memory-pairs",
  "simon-sequence",
  "mini-sudoku",
  "mini-nonogram",
  "sliding-puzzle",
  "escape",
  "time-maze",
  "zip",
  "pipes",
  "error-reconstruction",
]);

const migratedExamples = [...migratedTypes].map(
  (type) =>
    QUESTION_FORMAT_CATALOG[type as keyof typeof QUESTION_FORMAT_CATALOG].examples[0].question,
);

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

function renderQuestionWithoutVariant(question: Question) {
  return renderToStaticMarkup(
    <QuestionInput
      question={question}
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

function interactiveOpenings(markup: string) {
  return [...markup.matchAll(/<(?:button|input|select|textarea)\b[^>]*>/g)].map(
    ([opening]) => opening,
  );
}

describe("question format visual variants", () => {
  it("forwards default and Flash Pop variants to all thirty-one migrated formats", () => {
    expect(migratedExamples).toHaveLength(31);

    migratedExamples.forEach((question) => {
      const defaultMarkup = renderQuestion(question, "default");
      const popMarkup = renderQuestion(question, "flash-pop");
      expect(defaultMarkup).toContain('data-variant="default"');
      expect(popMarkup).toContain('data-variant="flash-pop"');
      expect(popMarkup).not.toEqual(defaultMarkup);
    });
  });

  it("defaults every renderer root to the legacy variant when omitted", () => {
    migratedExamples.forEach((question) => {
      expect(renderQuestionWithoutVariant(question)).toContain('data-variant="default"');
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
    migratedExamples.forEach((question) => {
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
      const controls = interactiveOpenings(markup);
      if (controls.length > 0) {
        const enabledControls = controls.filter(
          (opening) => !/\sdisabled(?:="")?(?=\s|>)/.test(opening),
        );
        expect(enabledControls, question.type).toEqual([]);
      }
    });
  });
});
