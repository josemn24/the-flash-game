import { afterEach, expect, it, vi } from "vitest";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import {
  sessionCases,
  definitionFor,
  correctActions,
  resolvedFor,
  testDictionaries,
} from "@/test-utils/game-session-conformance/corpus";
import { CompetitiveSessionEngine } from "./sessionEngine";

afterEach(() => vi.useRealTimers());
it.each(sessionCases)(
  "the existing engine completes $id with local authority and the same transitions",
  async (example) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    const definition = definitionFor(example);
    const engine = new CompetitiveSessionEngine({
      challenge: definition.challenge,
      initialSession: { status: "new", results: [], score: 0 },
      provider: createLocalPyramidSessionProvider({ definition, dictionaries: testDictionaries }),
    });
    try {
      await engine.lifecycle.begin();
      expect(engine.getSnapshot().phase).toBe("briefing");
      for (let index = 0; index < 7; index++) {
        await engine.startQuestions();
        expect(engine.getSnapshot().phase).toBe("preparing");
        await engine.lifecycle.activate();
        expect(engine.getSnapshot().phase).toBe("playing");
        for (const action of correctActions(resolvedFor(definition, index))) {
          switch (action.operation) {
            case "answer":
              await engine.interactions.submit(action.input.answer);
              break;
            case "queensValidation":
              await engine.interactions.validateQueensBoard(action.input.queens);
              break;
            case "miniWordleGuess":
              await engine.interactions.submitMiniWordleGuess(action.input.guess);
              break;
            case "logicCodeAttempt":
              await engine.interactions.submitLogicCodeAttempt(action.input.code);
              break;
            case "wordSearchSelection":
              await engine.interactions.submitWordSearchSelection(
                action.input.startCell,
                action.input.endCell,
              );
              break;
            case "wordHashtagSwap":
              await engine.interactions.submitWordHashtagSwap(
                action.input.fromCell,
                action.input.toCell,
              );
              break;
            default:
              throw new Error("unexpected action");
          }
        }
        await vi.runAllTimersAsync();
        expect(engine.getSnapshot().results).toHaveLength(index + 1);
      }
      expect(engine.getSnapshot()).toMatchObject({
        phase: "results",
        score: 100,
        pendingCommand: null,
      });
      expect(engine.getSnapshot().reviewChallenge?.mode).toBe("pyramid");
    } finally {
      engine.dispose();
    }
  },
);
