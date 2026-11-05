// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayableFormatExample } from "./PlayableFormatExample.client";
import { practiceInputFor } from "@/test-utils/practiceInput";

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event("close"));
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
function start() {
  fireEvent.click(screen.getByRole("button", { name: "Probar este formato" }));
  fireEvent.click(screen.getByRole("button", { name: "Empezar ejemplo" }));
}

describe("playable practice composition", () => {
  it("preserves local completion, review, attempt remount and closing", () => {
    const question = practiceInputFor("short-text").props.question;
    render(<PlayableFormatExample title="Ejemplo" question={question} rules={[]} />);
    start();
    const input = screen.getByLabelText<HTMLInputElement>("Escribe tu respuesta");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: " 1945 " } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("heading", { name: "Resultado del ejemplo" })).toBeTruthy();
    expect(screen.getAllByText("Respuesta correcta").length).toBeGreaterThan(0);
    expect(screen.getAllByText(question.explanation).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    const next = screen.getByLabelText<HTMLInputElement>("Escribe tu respuesta");
    expect(next).not.toBe(input);
    expect(next.value).toBe("");
    expect(document.activeElement).toBe(next);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar ejemplo" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Probar este formato" }));
    expect(screen.getByRole("button", { name: "Empezar ejemplo" })).toBeTruthy();
  });

  it("keeps an incorrect code local and passes the latest submitted codes to timeout review", async () => {
    vi.useFakeTimers();
    const question = { ...practiceInputFor("logic-code").props.question, timeLimit: 1 };
    render(<PlayableFormatExample title="Ejemplo" question={question} rules={[]} />);
    start();
    const first = screen.getByLabelText("Cifra 1 de 3");
    const wrong = question.correctAnswer === "000" ? "111" : "000";
    fireEvent.change(first, { target: { value: wrong } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByText("Código incorrecto. Prueba otra combinación.")).toBeTruthy();
    expect(screen.getByText("1 intento incorrecto")).toBeTruthy();
    expect(document.activeElement).toBe(first);
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("Respuesta incorrecta", { exact: true })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Resultado del ejemplo" })).toBeTruthy();
    expect(screen.getAllByText(wrong).length).toBeGreaterThan(0);
  });

  it("preserves the ordering timeout policy and resets the draft on retry", async () => {
    vi.useFakeTimers();
    const question = { ...practiceInputFor("ordering").props.question, timeLimit: 1 };
    render(<PlayableFormatExample title="Ejemplo" question={question} rules={[]} />);
    start();
    fireEvent.click(screen.getByRole("button", { name: `Mover ${question.items[0]} abajo` }));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("Tiempo agotado", { exact: true })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Resultado del ejemplo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("1 segundos restantes");
  });
});
