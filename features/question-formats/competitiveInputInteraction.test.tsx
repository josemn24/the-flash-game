// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { competitiveInputFor } from "@/test-utils/competitiveInput";
import { CompetitiveQuestionInput } from "./competitiveInputRegistry";

afterEach(cleanup);

describe("competitive generic input families", () => {
  it("submits a boolean and blocks further interaction when locked", () => {
    const submit = vi.fn();
    const { rerender } = render(
      <CompetitiveQuestionInput input={competitiveInputFor("true-false", { submit })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Verdadero" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(true);
    rerender(
      <CompetitiveQuestionInput
        input={competitiveInputFor("true-false", { submit, locked: true })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Falso" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("restores the pending multiple-choice selection and sends the chosen option", () => {
    const submit = vi.fn();
    const initial = competitiveInputFor("multiple-choice");
    const [first, second] = initial.props.question.options;
    render(
      <CompetitiveQuestionInput
        input={competitiveInputFor("multiple-choice", { submit, pendingAnswer: first })}
      />,
    );
    expect(screen.getByRole("button", { name: first }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: second }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(second);
  });

  it("restores classification, publishes its full draft and submits it", () => {
    const submit = vi.fn(),
      updateDraft = vi.fn();
    const { question } = competitiveInputFor("classification").props;
    const category = question.categories[0];
    const pendingAnswer = { [question.items[0].label]: category };
    render(
      <CompetitiveQuestionInput
        input={competitiveInputFor("classification", { submit, updateDraft, pendingAnswer })}
      />,
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    const expected = Object.fromEntries(question.items.map((item) => [item.label, category]));
    for (const item of question.items) {
      fireEvent.click(
        within(screen.getByRole("group", { name: `Clasificar ${item.label}` })).getAllByRole(
          "button",
        )[0],
      );
    }
    expect(updateDraft).toHaveBeenLastCalledWith(expected);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar clasificación" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it("restores a numeric estimation and submits the session's updated draft", () => {
    const submit = vi.fn(),
      updateDraft = vi.fn();
    const { question } = competitiveInputFor("estimation").props;
    const initial = question.min + question.step;
    const next = initial + question.step;
    const { rerender } = render(
      <CompetitiveQuestionInput
        input={competitiveInputFor("estimation", { submit, updateDraft, pendingAnswer: initial })}
      />,
    );
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe(
      `${initial} ${question.unit}`,
    );
    fireEvent.change(screen.getByRole("slider"), { target: { value: String(next) } });
    expect(updateDraft).toHaveBeenCalledExactlyOnceWith(next);
    rerender(
      <CompetitiveQuestionInput
        input={competitiveInputFor("estimation", { submit, updateDraft, pendingAnswer: next })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estimación" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(next);
  });

  it("restores a point and preserves keyboard progress and submission", () => {
    const submit = vi.fn(),
      updateDraft = vi.fn();
    render(
      <CompetitiveQuestionInput
        input={competitiveInputFor("heat-map", {
          submit,
          updateDraft,
          pendingAnswer: { x: 0.25, y: 0.75 },
        })}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /Pulsa sobre la imagen/ }), {
      key: "ArrowRight",
      shiftKey: true,
    });
    expect(updateDraft).toHaveBeenCalledExactlyOnceWith({ x: 0.3, y: 0.75 });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ubicación" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith({ x: 0.3, y: 0.75 });
  });
});
