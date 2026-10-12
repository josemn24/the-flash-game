import { COMPETITIVE_ADAPTERS } from "@/features/game/competitive/formats/adapter";
import { COMPETITIVE_INPUT_RENDERERS } from "@/features/question-formats/competitiveInputRegistry";
import {
  COMPETITIVE_REVIEW_ADAPTERS,
  reviewQuestion,
} from "@/features/question-formats/reviewRegistry";
import { normalizeCompetitiveEvaluationContext } from "@/infrastructure/supabase/attempts/normalize-competitive-context";
import { parseFlashEditorialQuestionDocument } from "@/lib/editorial/flashDocument";
import { COMPETITIVE_RESOLVERS } from "@/server/evaluation/formats/registry";
import { resolveCompetitiveQuestion } from "@/server/evaluation/resolve-competitive-question";
import { corpus, evaluationContext, runtimePayload } from "@/test-utils/format-contracts/context";
import type { GameMode } from "@/types/domain/content";
import { describe, expect, it } from "vitest";
import {
  COMPETITIVE_FORMAT_TYPES,
  competitiveCapabilityFor,
  type CompetitiveQuestionType,
} from "./definitions";
import { FORMAT_PUBLIC_VALIDATORS } from "./publicRegistry";
import { STORED_PUBLIC_VALIDATORS } from "./storedPublicRegistry";
import { FORMAT_SOLUTION_VALIDATORS, validateStoredQuestion } from "./storedRegistry";

const modes: readonly GameMode[] = ["flash", "survival", "pyramid", "narrative", "alphabet"];
describe("competitive format contracts across layers", () => {
  it("reads historical envelope metadata without weakening new publication", () => {
    for (const test of corpus.filter((test) => test.valid)) {
      const context = evaluationContext(test);
      const publicPayload = {
        ...(test.document.publicPayload as Record<string, unknown>),
        id: "legacy-question",
        context: "Contexto publicado",
        timeLimitMs: context.timeLimitMs,
      };
      const before = structuredClone(publicPayload);
      expect(() =>
        normalizeCompetitiveEvaluationContext({
          ...context,
          publicPayload: publicPayload as typeof context.publicPayload,
        }),
      ).not.toThrow();
      if (test.inline)
        expect(() =>
          parseFlashEditorialQuestionDocument({ ...test.document, publicPayload }),
        ).toThrow();
      expect(publicPayload).toEqual(before);
    }
  });
  it("covers all formats and declared published payload versions with real implementations", () => {
    expect(new Set(corpus.filter((t) => t.valid).map((t) => t.document.type))).toEqual(
      new Set(COMPETITIVE_FORMAT_TYPES),
    );
    for (const registry of [
      STORED_PUBLIC_VALIDATORS,
      FORMAT_PUBLIC_VALIDATORS,
      FORMAT_SOLUTION_VALIDATORS,
      COMPETITIVE_RESOLVERS,
      COMPETITIVE_INPUT_RENDERERS,
      COMPETITIVE_REVIEW_ADAPTERS,
    ]) {
      expect(Object.keys(registry).sort()).toEqual([...COMPETITIVE_FORMAT_TYPES].sort());
      for (const value of Object.values(registry)) expect(value).toBeTypeOf("function");
    }
    for (const type of COMPETITIVE_FORMAT_TYPES)
      for (const mode of modes) {
        const capability = competitiveCapabilityFor(type, mode);
        if (!capability) continue;
        expect(COMPETITIVE_ADAPTERS[capability.adapterKey].compose).toBeTypeOf("function");
        expect(COMPETITIVE_ADAPTERS[capability.adapterKey].normalize).toBeTypeOf("function");
        for (const version of capability.payloadSchemaVersions)
          expect(
            corpus.some(
              (t) =>
                t.valid && t.document.type === type && t.document.payloadSchemaVersion === version,
            ),
          ).toBe(true);
      }
  });
  it.each(corpus)("validates $id without mutating storage", (test) => {
    const before = structuredClone(test.document);
    const context = evaluationContext(test);
    const result = validateStoredQuestion(context);
    expect(result.ok).toBe(test.valid);
    if (test.inline) {
      if (test.valid)
        expect(parseFlashEditorialQuestionDocument(test.document)).toEqual(test.document);
      else expect(() => parseFlashEditorialQuestionDocument(test.document)).toThrow();
    }
    if (test.id.endsWith("-invalid-public") || test.id.endsWith("-public-null")) {
      const type = test.document.type as CompetitiveQuestionType;
      expect(
        FORMAT_PUBLIC_VALIDATORS[type]({
          id: context.receiptId,
          ...runtimePayload(test),
          timeLimitMs: context.timeLimitMs,
          points: 50,
          payloadSchemaVersion: context.payloadSchemaVersion,
        }).ok,
      ).toBe(false);
    }
    if (test.valid && result.ok) {
      const type = test.document.type as CompetitiveQuestionType;
      const normalized = normalizeCompetitiveEvaluationContext(context);
      expect(normalized).toEqual(result.value);
      const resolved = resolveCompetitiveQuestion(normalized);
      expect(resolved.type).toBe(type);
      const runtime = runtimePayload(test);
      const publicContext = {
        id: context.receiptId,
        ...runtime,
        timeLimitMs: context.timeLimitMs,
        points: 50,
        payloadSchemaVersion: context.payloadSchemaVersion,
      };
      const publicResult = FORMAT_PUBLIC_VALIDATORS[type](publicContext);
      expect(publicResult.ok).toBe(true);
      if (!publicResult.ok) throw new Error(JSON.stringify(publicResult.issues));
      if (["multiple-choice", "estimation", "heat-map", "progressive-image"].includes(type)) {
        const runtimeContext = {
          ...context,
          publicPayload: runtime.payload as typeof context.publicPayload,
        };
        expect(() =>
          normalizeCompetitiveEvaluationContext(runtimeContext, "authorized-runtime"),
        ).not.toThrow();
        if (
          context.payloadSchemaVersion === 2 &&
          JSON.stringify(test.document.publicPayload).includes("assetId")
        ) {
          expect(() => normalizeCompetitiveEvaluationContext(runtimeContext)).toThrow(
            "invalid_question_payload",
          );
        }
      }
      const reviewed = reviewQuestion(publicResult.value, {
        challengeItemId: context.receiptId,
        publicPayload: test.document.publicPayload,
        solutionPayload: test.document.solutionPayload,
      });
      expect(reviewed.type).toBe(type);
      const storedPublicResult = STORED_PUBLIC_VALIDATORS[type](test.document.publicPayload, {
        payloadSchemaVersion: context.payloadSchemaVersion,
        timeLimitMs: context.timeLimitMs,
        profile: "published",
      });
      expect(storedPublicResult.ok).toBe(true);
      if (!storedPublicResult.ok) throw new Error(JSON.stringify(storedPublicResult.issues));
      expect(
        FORMAT_SOLUTION_VALIDATORS[type](
          context,
          storedPublicResult.value as Record<string, unknown>,
          test.document.solutionPayload,
        ).ok,
      ).toBe(true);
      // Neither the answer nor private solution geometry is included in the public result.
      for (const key of [
        "correctAnswer",
        "acceptedAnswers",
        "solution",
        "solutionPaths",
        "referenceSolution",
        "optimalMoves",
      ])
        expect(publicResult.value).not.toHaveProperty(key);
      for (const mode of modes) {
        expect(competitiveCapabilityFor(type, mode) !== null).toBe(test.modes.includes(mode));
        if (test.modes.includes(mode))
          expect(() =>
            normalizeCompetitiveEvaluationContext(evaluationContext(test, mode)),
          ).not.toThrow();
        else
          expect(() =>
            normalizeCompetitiveEvaluationContext(evaluationContext(test, mode)),
          ).toThrow("unsupported_question");
        expect(FORMAT_PUBLIC_VALIDATORS[type]({ ...publicContext, mode }).ok).toBe(
          test.modes.includes(mode),
        );
      }
      expect(
        FORMAT_PUBLIC_VALIDATORS[type]({ ...publicContext, payloadSchemaVersion: 999 }).ok,
      ).toBe(false);
    }
    expect(test.document).toEqual(before);
  });
});
