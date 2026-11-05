// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnswerOption } from "@/components/questions/shared/AnswerOption";
import { TrueFalseQuestion } from "@/components/questions/formats/true-false/TrueFalseQuestion";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { practiceInput } from "@/test-utils/practiceInput";

const examples = Object.values(QUESTION_FORMAT_CATALOG).map(
  (format) => format.examples[0].question,
);
afterEach(cleanup);

describe("canonical practice format renderer", () => {
  it.each(examples)("renders $type enabled and locked using only its operations", (question) => {
    for (const locked of [false, true]) {
      const markup = renderToStaticMarkup(
        <QuestionInput input={practiceInput(question, { locked })} />,
      );
      expect(markup).toContain(`data-format="${question.type}"`);
      expect(markup).not.toContain('data-variant="flash-pop"');
      expect(markup).not.toContain("data-theme");
      if (locked) {
        const controls = [...markup.matchAll(/<(?:button|input|select|textarea)\b[^>]*>/g)].map(
          ([opening]) => opening,
        );
        expect(controls.filter((opening) => !/\sdisabled(?:="")?(?=\s|>)/.test(opening))).toEqual(
          [],
        );
      }
    }
  });

  it("keeps AnswerOption and true/false submissions intact", () => {
    expect(examples).toHaveLength(31);
    const select = vi.fn();
    const submit = vi.fn();
    render(
      <>
        <AnswerOption label="Opción A" index={0} disabled={false} onSelect={select} />
        <TrueFalseQuestion locked={false} onSubmit={submit} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Opción A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Verdadero/ }));
    fireEvent.click(screen.getByRole("button", { name: /Falso/ }));
    expect(select).toHaveBeenCalledOnce();
    expect(submit.mock.calls).toEqual([[true], [false]]);
  });
});
