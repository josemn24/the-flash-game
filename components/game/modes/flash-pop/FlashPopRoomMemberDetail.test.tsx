// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  MatchingQuestion,
  MultipleChoiceQuestion,
  ShortTextQuestion,
} from "@/types/gameplay/practice";
import type { RoomMemberDetailModel, RoomMemberReviewItem } from "@/types/view-models/room";
import { FlashPopRoomMemberDetail } from "./FlashPopRoomMemberDetail.client";

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
      subtitle: choice.category,
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
      subtitle: matching.category,
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

afterEach(() => document.body.replaceChildren());

describe("FlashPopRoomMemberDetail", () => {
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
    expect(view.getByText("Todavía no ha jugado")).toBeTruthy();
    expect(view.queryByRole("region", { name: "Respuestas" })).toBeNull();
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
