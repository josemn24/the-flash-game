// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { competitiveFlash, competitiveRoomContext } from "@/test-utils/competitiveGameplay";
import { competitiveInputFor } from "@/test-utils/competitiveInput";
import type { ServerFlashSession } from "@/features/game/useServerFlashSession";
import { ServerFlashPopGame } from "./ServerFlashPopGame.client";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/features/game/useServerFlashSession", () => ({ useServerFlashSession: useSession }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("competitive answer feedback stays in the competitive shell", () => {
  it("keeps pending selection, checking feedback and retry on their current surfaces", () => {
    const initial = competitiveInputFor("multiple-choice");
    const option = initial.props.question.options[0];
    const input = competitiveInputFor("multiple-choice", { pendingAnswer: option, locked: true });
    const retrySubmit = vi.fn();
    let session: Partial<ServerFlashSession> = {
      phase: "playing",
      question: input.props.question,
      questionInput: input,
      questionIndex: 0,
      busy: false,
      retrySubmit,
    };
    useSession.mockImplementation(() => session);
    const view = render(
      <ServerFlashPopGame challenge={competitiveFlash} roomContext={competitiveRoomContext} />,
    );
    const selected = screen.getByRole<HTMLButtonElement>("button", { name: option });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(selected.disabled).toBe(true);
    expect(screen.queryByText("Comprobando respuesta…")).toBeNull();
    session = {
      ...session,
      phase: "checking",
      answerVerificationState: "submitting",
      answerVerificationStatusVisible: true,
    };
    view.rerender(
      <ServerFlashPopGame challenge={competitiveFlash} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByText("Comprobando respuesta…")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("button", { name: option })).toBeNull();
    session = {
      ...session,
      answerVerificationState: "error",
      answerVerificationError: "No hemos podido confirmar tu respuesta.",
    };
    view.rerender(
      <ServerFlashPopGame challenge={competitiveFlash} roomContext={competitiveRoomContext} />,
    );
    expect(screen.getByText("No hemos podido confirmar tu respuesta.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retrySubmit).toHaveBeenCalledOnce();
  });
});
