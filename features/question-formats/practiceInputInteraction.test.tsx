// @vitest-environment jsdom
import { createElement, type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionInput } from "./QuestionInput";
import { FlashQuestionStage } from "@/components/game/shared/QuestionStagePresets";
import { practiceInputFor } from "@/test-utils/practiceInput";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";

vi.mock("@/lib/miniWordleDictionary", () => ({ loadMiniWordleDictionary: vi.fn() }));
vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => {
    const domProps = { ...props };
    for (const key of ["preload", "unoptimized", "priority", "fill"])
      Reflect.deleteProperty(domProps, key);
    return createElement("img", domProps);
  },
}));
beforeEach(() => {
  vi.mocked(loadMiniWordleDictionary).mockResolvedValue(new Set(["LUNA", "CASA"]));
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("practice-specific inputs", () => {
  it("submits direct answers and blocks subsequent interaction when locked", () => {
    const onSubmit = vi.fn();
    const input = practiceInputFor("multiple-choice", { onSubmit });
    const view = render(<QuestionInput input={input} />);
    for (const option of screen.getAllByRole("button")) {
      expect(option.getAttribute("aria-pressed")).toBe("false");
    }
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(input.props.question.options[0]) }),
    );
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(input.props.question.options[0]);
    view.rerender(<QuestionInput input={{ ...input, props: { ...input.props, locked: true } }} />);
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(input.props.question.options[1]) }),
    );
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("keeps short-text focus, trimming and reset on a new attempt key", () => {
    const onSubmit = vi.fn();
    const input = practiceInputFor("short-text", { onSubmit });
    const view = render(<QuestionInput key="attempt-1" input={input} />);
    const field = screen.getByLabelText<HTMLInputElement>("Escribe tu respuesta");
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: " 1945 " } });
    fireEvent.submit(field.closest("form")!);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("1945");
    view.rerender(<QuestionInput key="attempt-2" input={input} />);
    expect(screen.getByLabelText<HTMLInputElement>("Escribe tu respuesta").value).toBe("");
    expect(document.activeElement).toBe(screen.getByLabelText("Escribe tu respuesta"));
  });

  it("restores classification and publishes and submits the complete draft", () => {
    const onProgress = vi.fn(),
      onSubmit = vi.fn();
    const question = practiceInputFor("classification").props.question;
    const category = question.categories[0];
    const initialAnswer = { [question.items[0].label]: category };
    render(
      <QuestionInput
        input={practiceInputFor("classification", { initialAnswer, onProgress, onSubmit })}
      />,
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    for (const item of question.items)
      fireEvent.click(
        within(screen.getByRole("group", { name: `Clasificar ${item.label}` })).getAllByRole(
          "button",
        )[0],
      );
    const expected = Object.fromEntries(question.items.map((item) => [item.label, category]));
    expect(onProgress).toHaveBeenLastCalledWith(expected);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar clasificación" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it("keeps estimation state local even when a session draft is present", () => {
    const onProgress = vi.fn(),
      onSubmit = vi.fn();
    const input = practiceInputFor("estimation", { initialAnswer: 999, onProgress, onSubmit });
    const { question } = input.props;
    render(<QuestionInput input={input} />);
    expect(screen.getByRole<HTMLInputElement>("slider").value).toBe(String(question.initialValue));
    const value = question.min + question.step;
    fireEvent.change(screen.getByRole("slider"), { target: { value: String(value) } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estimación" }));
    expect(onProgress).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(value);
  });

  it("keeps heat-map keyboard selection local until confirmation", () => {
    const onProgress = vi.fn(),
      onSubmit = vi.fn();
    render(
      <QuestionInput
        input={practiceInputFor("heat-map", {
          initialAnswer: { x: 0.1, y: 0.9 },
          onProgress,
          onSubmit,
        })}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /Pulsa sobre la imagen/ }), {
      key: "ArrowRight",
      shiftKey: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ubicación" }));
    expect(onProgress).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ x: 0.55, y: 0.5 });
  });

  it("uses the boolean code result for local error, clearing and focus", () => {
    const onCodeAttempt = vi.fn((code: string) => code === "012");
    const onProgress = vi.fn(),
      onSubmit = vi.fn();
    const input = practiceInputFor("logic-code", {
      initialAnswer: "111",
      codeAttemptCount: 2,
      onCodeAttempt,
      onProgress,
      onSubmit,
    });
    const view = render(<QuestionInput input={input} />);
    const first = screen.getByLabelText<HTMLInputElement>("Cifra 1 de 3");
    expect(first.value).toBe("1");
    expect(screen.getByText("2 intentos incorrectos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByText("Código incorrecto. Prueba otra combinación.")).toBeTruthy();
    expect(first.value).toBe("");
    expect(document.activeElement).toBe(first);
    expect(onProgress).toHaveBeenLastCalledWith("");
    fireEvent.change(first, { target: { value: "012" } });
    fireEvent.keyDown(screen.getByLabelText("Cifra 3 de 3"), { key: "Enter" });
    expect(onCodeAttempt.mock.calls).toEqual([["111"], ["012"]]);
    expect(first.value).toBe("0");
    expect(onSubmit).not.toHaveBeenCalled();
    view.rerender(<QuestionInput input={{ ...input, props: { ...input.props, locked: true } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(onCodeAttempt).toHaveBeenCalledTimes(2);
  });

  it("restores clues and text, reveals through its own channel and submits trimmed text", () => {
    const onProgressiveClueReveal = vi.fn(),
      onProgress = vi.fn(),
      onSubmit = vi.fn();
    render(
      <QuestionInput
        input={practiceInputFor("progressive-clues", {
          initialAnswer: "Marie",
          progressiveCluesRevealed: 2,
          onProgressiveClueReveal,
          onProgress,
          onSubmit,
        })}
      />,
    );
    const field = screen.getByLabelText<HTMLInputElement>("Escribe tu respuesta");
    expect(field.value).toBe("Marie");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Revelar otra pista/ }));
    expect(onProgressiveClueReveal).toHaveBeenCalledExactlyOnceWith(3);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.change(field, { target: { value: " Curie " } });
    expect(onProgress).toHaveBeenLastCalledWith(" Curie ");
    fireEvent.submit(field.closest("form")!);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Curie");
  });

  it("reports a wrong matching pair locally without submitting it", () => {
    const onIncorrectAttempt = vi.fn(),
      onSubmit = vi.fn(),
      onProgress = vi.fn();
    const input = practiceInputFor("matching", { onIncorrectAttempt, onSubmit, onProgress });
    const left = input.props.question.leftItems[0];
    const wrong = input.props.question.rightItems.find((item) => item.id !== left.correctMatchId)!;
    render(<QuestionInput input={input} />);
    fireEvent.click(screen.getByRole("button", { name: left.label }));
    fireEvent.click(screen.getByRole("button", { name: wrong.label }));
    expect(onIncorrectAttempt).toHaveBeenCalledOnce();
    expect(screen.getByText(`${left.label} y ${wrong.label} no forman una pareja.`)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe("shared practice stage timer", () => {
  it.each(["flash-memory", "simon-sequence"] as const)(
    "starts %s once after presentation and preserves timeout",
    async (format) => {
      vi.useFakeTimers();
      const onTimedResponseStart = vi.fn(),
        onTimeUp = vi.fn();
      const input = practiceInputFor(format, { onTimedResponseStart });
      const view = render(
        <FlashQuestionStage
          input={input}
          questionNumber={1}
          totalQuestions={2}
          onTimeUp={onTimeUp}
        />,
      );
      expect(onTimedResponseStart).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(onTimedResponseStart).toHaveBeenCalledOnce();
      view.rerender(
        <FlashQuestionStage
          input={input}
          questionNumber={1}
          totalQuestions={2}
          onTimeUp={onTimeUp}
        />,
      );
      await act(async () => {
        vi.advanceTimersByTime(input.props.question.timeLimit * 1000 + 200);
      });
      expect(onTimeUp).toHaveBeenCalledOnce();
      expect(onTimedResponseStart).toHaveBeenCalledOnce();
    },
  );

  it("starts Mini-Wordle after dictionary readiness and keeps its board on parent rerenders", async () => {
    let resolve!: (words: Set<string>) => void;
    vi.mocked(loadMiniWordleDictionary).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const onTimedResponseStart = vi.fn();
    const input = practiceInputFor("mini-wordle", { onTimedResponseStart });
    const view = render(
      <FlashQuestionStage input={input} questionNumber={1} totalQuestions={1} onTimeUp={vi.fn()} />,
    );
    expect(onTimedResponseStart).not.toHaveBeenCalled();
    await act(async () => resolve(new Set(["LUNA", "CASA"])));
    expect(onTimedResponseStart).toHaveBeenCalledOnce();
    const field = screen.getByLabelText("Escribe tu intento");
    fireEvent.change(field, { target: { value: "CASA" } });
    fireEvent.submit(field.closest("form")!);
    view.rerender(
      <FlashQuestionStage input={input} questionNumber={1} totalQuestions={1} onTimeUp={vi.fn()} />,
    );
    expect(screen.getByLabelText("Intento 1: CASA", { exact: true })).toBeTruthy();
    expect(onTimedResponseStart).toHaveBeenCalledOnce();
  });

  it("starts progressive-image only when the image has loaded, including repeated load events", () => {
    const onTimedResponseStart = vi.fn();
    const input = practiceInputFor("progressive-image", { onTimedResponseStart });
    render(
      <FlashQuestionStage input={input} questionNumber={1} totalQuestions={1} onTimeUp={vi.fn()} />,
    );
    expect(onTimedResponseStart).not.toHaveBeenCalled();
    const image = screen.getByAltText(input.props.question.surface.alt);
    fireEvent.load(image);
    fireEvent.load(image);
    expect(onTimedResponseStart).toHaveBeenCalledOnce();
    expect(screen.getByRole<HTMLInputElement>("textbox").disabled).toBe(false);
  });

  it("keeps timeout disabled while locked and resets the timer for the next question", async () => {
    vi.useFakeTimers();
    const onTimeUp = vi.fn();
    const first = practiceInputFor("true-false", { locked: true });
    const view = render(
      <FlashQuestionStage
        input={first}
        questionNumber={1}
        totalQuestions={2}
        onTimeUp={onTimeUp}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(onTimeUp).not.toHaveBeenCalled();
    const next = practiceInputFor("short-text");
    view.rerender(
      <FlashQuestionStage input={next} questionNumber={2} totalQuestions={2} onTimeUp={onTimeUp} />,
    );
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      `${next.props.question.timeLimit} segundos restantes`,
    );
    await act(async () => {
      vi.advanceTimersByTime(next.props.question.timeLimit * 1000 + 200);
    });
    expect(onTimeUp).toHaveBeenCalledOnce();
  });
});
