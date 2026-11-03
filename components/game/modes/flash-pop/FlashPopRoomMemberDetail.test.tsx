// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  MatchingQuestion,
  MultipleChoiceQuestion,
  ShortTextQuestion,
} from "@/types/gameplay/practice";
import type { RoomMemberDetailModel, RoomMemberReviewItem } from "@/types/view-models/room";
import { FlashPopRoomMemberDetail } from "./FlashPopRoomMemberDetail.client";

const dialogPrototype = HTMLDialogElement.prototype;
const nativeShowModal = Object.getOwnPropertyDescriptor(dialogPrototype, "showModal");
const nativeClose = Object.getOwnPropertyDescriptor(dialogPrototype, "close");

beforeEach(() => {
  Object.defineProperty(dialogPrototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(dialogPrototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
});

const questionBase = {
  category: "Cultura",
  tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
  timeLimit: 30,
  explanation: "Explicación de la respuesta.",
};

function flashItems(): RoomMemberReviewItem[] {
  const choice: MultipleChoiceQuestion = {
    ...questionBase,
    id: "choice",
    type: "multiple-choice",
    points: 46,
    question: "Capital de Portugal",
    options: ["Lisboa", "Oporto"],
    correctAnswer: "Lisboa",
  };
  const matching: MatchingQuestion = {
    ...questionBase,
    id: "matching",
    type: "matching",
    points: 54,
    question: "Empareja cada concepto",
    leftItems: Array.from({ length: 4 }, (_, index) => ({
      id: `left-${index}`,
      label: `Concepto ${index + 1}`,
      correctMatchId: `right-${index}`,
    })),
    rightItems: Array.from({ length: 4 }, (_, index) => ({
      id: `right-${index}`,
      label: `Pareja ${index + 1}`,
    })),
  };
  return [
    {
      id: choice.id,
      title: choice.question,
      subtitle: `Elección · ${choice.category}`,
      question: choice,
      status: "incorrect",
      result: {
        questionId: choice.id,
        answer: "Oporto",
        status: "incorrect",
        isCorrect: false,
        points: 0,
        timeUsed: 1,
      },
    },
    {
      id: matching.id,
      title: matching.question,
      subtitle: `Emparejar · ${matching.category}`,
      question: matching,
      status: "correct",
      result: {
        questionId: matching.id,
        answer: Object.fromEntries(
          matching.leftItems.map((item) => [item.id, item.correctMatchId]),
        ),
        status: "correct",
        isCorrect: true,
        points: 54,
        timeUsed: 1,
        details: { type: "matching", correctPairs: 4, totalPairs: 4 },
      },
    },
  ];
}

function memberModel({
  items = flashItems(),
  progress = { mode: "flash", answeredCount: 2, totalQuestionCount: 2 },
  completed = true,
  points = 54,
}: {
  items?: RoomMemberReviewItem[];
  progress?: RoomMemberDetailModel["reviewProgress"];
  completed?: boolean;
  points?: number;
} = {}): RoomMemberDetailModel {
  return {
    roomId: "test-room",
    roomTitle: "Tabarnia",
    source: "supabase",
    member: {
      id: "ches",
      name: "Dark",
      initials: "D",
      totalFlashPoints: 232,
      challengeResults: {},
    },
    challengeSummary: {
      id: "test-challenge",
      mode: "flash",
      title: "Prueba de cultura",
      formatLabel: "Flash",
      subtitle: "",
      imageSrc: "",
      questionCount: items.length,
      playedAt: "2026-09-01T20:30:00.000Z",
    },
    challenge: null,
    result: {
      flashPoints: points,
      completed,
      attempt: {
        challengeId: "test-challenge",
        startedAt: "2026-09-01T20:29:00.000Z",
        playedAt: "2026-09-01T20:30:00.000Z",
        durationMs: 60000,
        flashPoints: points,
        completed,
        answers: items.flatMap((item) => (item.result ? [item.result] : [])),
      },
    },
    reviewItems: items,
    reviewProgress: progress,
    roomRank: 3,
    challengeRank: 1,
    roomLeaderboard: [],
    challengeLeaderboard: [],
    returnHref: "/salas/test-room/ranking",
  };
}

function renderModel(model: RoomMemberDetailModel) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<FlashPopRoomMemberDetail model={model} />);
  document.body.append(container);
  return within(container);
}

afterEach(() => {
  document.body.replaceChildren();
  if (nativeShowModal) Object.defineProperty(dialogPrototype, "showModal", nativeShowModal);
  else Reflect.deleteProperty(dialogPrototype, "showModal");
  if (nativeClose) Object.defineProperty(dialogPrototype, "close", nativeClose);
  else Reflect.deleteProperty(dialogPrototype, "close");
});

describe("FlashPopRoomMemberDetail", () => {
  it.each(["flash", "survival"] as const)(
    "shows complete questions and the original %s member counter",
    (mode) => {
      const model = memberModel({
        progress:
          mode === "flash"
            ? { mode, answeredCount: 2, totalQuestionCount: 2 }
            : {
                mode,
                reachedQuestionCount: 2,
                totalQuestionCount: 20,
                initialLives: 3,
                livesRemaining: 2,
                outcome: "in_progress",
              },
      });
      model.challengeSummary = { ...model.challengeSummary!, mode };
      const view = renderModel(model);
      const history = view.getByRole("region", { name: "Respuestas" });
      const row = history.querySelector("details")!;
      expect(row.querySelector("summary strong")?.textContent).toBe("Capital de Portugal");
      expect(row.querySelector("summary small")?.textContent).toBe("Elección · Cultura");
      const fullQuestion = within(row).getByText("Pregunta").parentElement!;
      expect(fullQuestion.querySelector("p")?.textContent).toBe("Capital de Portugal");
      expect(within(row).getByText(questionBase.explanation)).toBeTruthy();
      expect(
        within(history).getByText(mode === "flash" ? "2 respuestas" : "2 preguntas alcanzadas"),
      ).toBeTruthy();
    },
  );

  it("renders the challenge score, rank, date and expandable answer history", () => {
    const view = renderModel(memberModel());
    expect(view.getByRole("heading", { name: "Dark" })).toBeTruthy();
    const summary = within(view.getByRole("region", { name: "Prueba de cultura" }));
    expect(summary.getByText("54", { selector: "strong" })).toBeTruthy();
    expect(summary.getByText("Puntos del reto")).toBeTruthy();
    expect(summary.getByText("#1", { selector: "strong" })).toBeTruthy();
    expect(summary.getByText("ranking del reto")).toBeTruthy();
    expect(summary.queryByText("232")).toBeNull();
    expect(summary.queryByText("#3")).toBeNull();
    expect(summary.getByLabelText(/^Jugado el/).getAttribute("datetime")).toBe(
      "2026-09-01T20:30:00.000Z",
    );
    const history = view.getByRole("region", { name: "Respuestas" });
    expect(history.querySelectorAll("details")).toHaveLength(2);
    expect(within(history).getByText("Respuesta correcta")).toBeTruthy();
    expect(within(history).getByText(/4\/4 parejas correctas/)).toBeTruthy();
    expect(
      view.getByRole("link", { name: "Volver al origen del resultado" }).getAttribute("href"),
    ).toBe("/salas/test-room/ranking");
    expect(view.queryByText("Desglose completo")).toBeNull();
  });

  it("renders a clear empty state for pending players", () => {
    const model = memberModel({ items: [], progress: null });
    model.member = { ...model.member, name: "Palmera", initials: "P" };
    model.result = null;
    const view = renderModel(model);
    expect(view.getByRole("heading", { name: "Palmera" })).toBeTruthy();
    expect(view.getByRole("img", { name: "Palmera" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Ampliar foto de Palmera" })).toBeNull();
    expect(view.getByText("Todavía no ha jugado")).toBeTruthy();
    expect(view.queryByRole("region", { name: "Respuestas" })).toBeNull();
  });

  it("opens the complete member photo in an accessible dialog and supports each close method", () => {
    const model = memberModel();
    model.member = { ...model.member, avatarSrc: "/flash-pop/avatars/ches.jpeg" };
    const view = render(<FlashPopRoomMemberDetail model={model} />);
    const trigger = view.getByRole("button", { name: "Ampliar foto de Dark" });
    const dialog = view.container.querySelector("dialog")!;

    expect(dialog.open).toBe(false);
    fireEvent.click(trigger);
    expect(dialog.open).toBe(true);
    expect(view.getByRole("dialog", { name: "Foto de perfil de Dark" })).toBe(dialog);
    expect(view.getByRole("img", { name: "Foto de perfil de Dark" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Cerrar foto de Dark" }));
    expect(dialog.open).toBe(false);

    fireEvent.click(trigger);
    const cancelEvent = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);

    fireEvent.click(trigger);
    fireEvent.click(dialog);
    expect(dialog.open).toBe(false);
  });

  it.each(["completed", "abandoned"] as const)(
    "renders every Alphabet letter for a %s attempt",
    (status) => {
      const items: RoomMemberReviewItem[] = [
        { letter: "A", prompt: "Animal con placas óseas", answer: "armadillo" },
        { letter: "B", prompt: "País más extenso de Sudamérica", answer: "Brasil" },
      ].map(({ letter, prompt, answer }) => {
        const question: ShortTextQuestion = {
          ...questionBase,
          id: `letter-${letter}`,
          type: "short-text",
          points: 50,
          question: prompt,
          correctAnswer: answer,
        };
        return {
          id: question.id,
          title: question.question,
          subtitle: `Letra ${letter}`,
          question,
          metadata: { alphabetLetter: letter },
          status: "unanswered",
          result: {
            questionId: question.id,
            answer: null,
            status: "unanswered",
            isCorrect: false,
            points: 0,
            timeUsed: 0,
          },
        };
      });
      const model = memberModel({
        items,
        completed: status === "completed",
        points: 0,
        progress: { mode: "alphabet", answeredCount: 0, correctCount: 0, totalLetterCount: 2 },
      });
      model.challengeSummary = {
        ...model.challengeSummary!,
        mode: "alphabet",
        title: "Reino de animales",
        formatLabel: "Alfabeto",
      };
      const view = renderModel(model);
      expect(view.getByRole("heading", { name: "Reino de animales" })).toBeTruthy();
      const history = within(view.getByRole("region", { name: "Respuestas" }));
      expect(history.getByText("0 de 2 letras acertadas")).toBeTruthy();
      expect(history.getAllByText("Sin responder")).toHaveLength(2);
      expect(history.getAllByText("Respuesta correcta")).toHaveLength(2);
      for (const letter of ["A", "B"])
        expect(history.getByText(letter, { exact: true })).toBeTruthy();
      expect(Boolean(view.queryByText("Partida abandonada"))).toBe(status === "abandoned");
    },
  );
});
