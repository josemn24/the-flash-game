import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ServerWordHashtagQuestion } from "./ServerWordHashtagQuestion";
import type { ServerWordHashtagQuestion as ServerQuestion } from "@/types/gameplay/challenge";

const letters = [
  null,
  "G",
  null,
  "Q",
  null,
  "E",
  "O",
  "P",
  "U",
  "I",
  null,
  "N",
  null,
  "Y",
  null,
  "R",
  "A",
  "U",
  "M",
  "E",
  null,
  "R",
  null,
  "A",
  null,
];

const question: ServerQuestion = {
  id: "word-hashtag-question",
  type: "word-hashtag",
  category: "Lengua",
  tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [] },
  question: "Intercambia las letras.",
  timeLimit: 60,
  points: 15,
  grid: { rows: 5, columns: 5 },
  initialLetters: letters,
  maxMoves: 3,
  progress: {
    kind: "word-hashtag",
    letters,
    correctCells: [3, 6, 8, 9, 11, 15, 17, 18, 21, 23],
    swaps: [],
    movesUsed: 0,
    movesRemaining: 3,
  },
};

describe("ServerWordHashtagQuestion", () => {
  it("marks correct cells and locks them while leaving displaced letters movable", () => {
    const markup = renderToStaticMarkup(
      <ServerWordHashtagQuestion
        question={question}
        locked={false}
        submissionState="idle"
        submissionStatusVisible={false}
        onSwap={vi.fn()}
      />,
    );

    expect(markup).toContain('data-word-hashtag-cell="3" data-state="correct"');
    expect(markup).toContain(
      'aria-label="Letra Q, fila 1, columna 4: posición correcta y bloqueada"',
    );
    expect(markup).toContain('data-word-hashtag-cell="1" data-state="displaced"');
    expect(markup).toMatch(/data-word-hashtag-cell="3"[^>]*disabled=""/);
    expect(markup).not.toMatch(/data-word-hashtag-cell="1"[^>]*disabled=""/);
  });
});
