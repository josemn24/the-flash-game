import type { PendingCommand } from "@/features/game/competitive/core/sessionReducer";
import { COMPETITIVE_ADAPTERS } from "@/features/game/competitive/formats/adapter";
import type { FormatAction } from "@/features/game/competitive/formats/types";
import { ReviewAnswerList } from "@/components/game/shared/ReviewAnswerList";
import {
  competitiveCapabilityFor,
  type CompetitiveQuestionType,
} from "@/lib/question-formats/definitions";
import { FORMAT_PUBLIC_VALIDATORS } from "@/lib/question-formats/publicRegistry";
import { corpus, runtimePayload } from "@/test-utils/format-contracts/context";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CompetitiveAdapterKey } from "./capabilities";
import { CompetitiveQuestionInput } from "./competitiveInputRegistry";
import { createCompetitiveInput } from "./createCompetitiveInput";
import { competitiveInputSource } from "@/test-utils/competitiveInput";
import { reviewQuestion } from "./reviewRegistry";

const actions: Record<CompetitiveAdapterKey, FormatAction> = {
  generic: { kind: "answer", answer: null },
  "alphabet-pass": { kind: "answer", answer: null },
  "mini-wordle": { kind: "mini-wordle", guess: "LUNA" },
  "logic-code": { kind: "logic-code", code: "123" },
  "progressive-clues": { kind: "reveal" },
  queens: { kind: "queens-validation", queens: [] },
  "word-search": { kind: "word-search", startCell: 0, endCell: 1 },
  "word-hashtag": { kind: "word-hashtag", fromCell: 0, toCell: 1 },
};
const operations = {
  generic: "answer",
  "alphabet-pass": "answer",
  "mini-wordle": "miniWordleGuess",
  "logic-code": "logicCodeAttempt",
  "progressive-clues": "progressiveClueReveal",
  queens: "queensValidation",
  "word-search": "wordSearchSelection",
  "word-hashtag": "wordHashtagSwap",
} as const;

describe("competitive registries execute their declared implementations", () => {
  it.each(corpus.filter((test) => test.valid))("renders and composes commands for $id", (test) => {
    const type = test.document.type as CompetitiveQuestionType;
    const publicResult = FORMAT_PUBLIC_VALIDATORS[type]({
      id: test.id,
      ...runtimePayload(test),
      timeLimitMs: test.document.timeLimitMs,
      points: 50,
      payloadSchemaVersion: test.document.payloadSchemaVersion,
    });
    if (!publicResult.ok) throw new Error(JSON.stringify(publicResult.issues));
    const question = publicResult.value;
    const callback = vi.fn();
    const source = competitiveInputSource({ question, submit: callback });
    const input = createCompetitiveInput(source);
    if (!input) throw new Error("missing_input");
    const markup = renderToStaticMarkup(createElement(CompetitiveQuestionInput, { input }));
    expect(markup).toMatch(/<(button|input|select|textarea)\b/);
    const locked = createCompetitiveInput({ ...source, locked: true });
    if (!locked) throw new Error("missing_locked_input");
    expect(() =>
      renderToStaticMarkup(createElement(CompetitiveQuestionInput, { input: locked })),
    ).not.toThrow();
    const reviewed = reviewQuestion(question, {
      challengeItemId: question.id,
      publicPayload: test.document.publicPayload,
      solutionPayload: test.document.solutionPayload,
    });
    const reviewMarkup = renderToStaticMarkup(
      createElement(ReviewAnswerList, {
        initialOpenId: question.id,
        entries: [
          {
            id: question.id,
            question: reviewed,
            marker: "01",
            result: {
              questionId: question.id,
              answer: null,
              status: "unanswered",
              isCorrect: false,
              points: 0,
              timeUsed: 1,
            },
          },
        ],
      }),
    );
    expect(reviewMarkup).toContain("<details");
    expect(reviewMarkup).toContain("0 puntos");

    for (const mode of test.modes) {
      const capability = competitiveCapabilityFor(
        type,
        mode as Parameters<typeof competitiveCapabilityFor>[1],
      );
      if (!capability) throw new Error("missing_capability");
      const adapter = COMPETITIVE_ADAPTERS[capability.adapterKey];
      const spec = adapter.compose(question, actions[capability.adapterKey]);
      expect(spec.operation).toBe(operations[capability.adapterKey]);
      expect(spec.data.challengeItemId).toBe(question.id);
      const command = {
        operation: spec.operation,
        input: { ...spec.data, sessionId: "attempt", revision: 1, idempotencyKey: "key" },
      } as PendingCommand;
      const outcome = adapter.normalize(question, command, {
        terminal: true,
        status: "correct",
        points: 50,
        timeUsedMs: 1000,
        attemptsUsed: 1,
        feedback: [],
        incorrectAttempts: 0,
        queens: [],
        placedQueens: 0,
        completedRows: 0,
        completedColumns: 0,
        completedRegions: 0,
        conflictingQueens: 0,
        foundSelections: [],
        foundWordIds: [],
        foundCount: 0,
        totalWords: 1,
        letters: [],
        correctCells: [],
        movesUsed: 1,
        movesRemaining: 1,
        clue: "Pista autorizada",
        revealedClues: 2,
        totalClues: 3,
        cluePenalty: 10,
        availablePoints: 40,
      });
      expect(outcome.question.type).toBe(type);
      expect(outcome.kind).toBe(
        capability.adapterKey === "progressive-clues" ? "progress" : "evaluated",
      );
    }
  });
});
