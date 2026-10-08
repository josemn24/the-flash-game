import { corpus, runtimePayload } from "@/test-utils/format-contracts/context";
import { describe, expect, it } from "vitest";
import type { RoomMemberReviewReadRow } from "./roomReadContracts";
import { toHistoricalFlashQuestion as after } from "./roomReviewQuestionMapper";

const cases = corpus.filter((test) => test.valid);
describe("historical question read boundary", () => {
  it.each(cases)("reads $id from flat and enveloped projections without mutating them", (test) => {
    const payload = runtimePayload(test).payload as Record<string, unknown>;
    if (test.document.type === "progressive-clues") {
      Object.assign(payload, test.document.publicPayload);
      delete payload.clueCount;
    }
    const tags = { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] };
    const publicPayload: Record<string, unknown> = {
      ...payload,
      category: payload.category ?? "Test",
      tags: { ...tags, ...((payload.tags as object) ?? {}) },
    };
    const storedSolution = test.document.solutionPayload as Record<string, unknown>;
    const solution: Record<string, unknown> = {
      ...storedSolution,
      explanation: storedSolution.explanation ?? "Explicación",
    };
    const row = {
      challenge_item_id: "item-id",
      question_type: test.document.type,
      challenge_mode: "flash",
      payload_schema_version: test.document.payloadSchemaVersion,
      time_limit_ms: test.document.timeLimitMs,
      item_points: 50,
      public_payload:
        test.document.type === "multiple-choice"
          ? {
              category: publicPayload.category ?? "",
              tags: publicPayload.tags,
              prompt: publicPayload.question,
              context: null,
              timeLimitMs: test.document.timeLimitMs,
              payload: {
                options: payload.options,
                media: payload.media ?? null,
                promptVisual: payload.promptVisual ?? null,
              },
            }
          : publicPayload,
      solution_payload:
        test.document.type === "multiple-choice"
          ? {
              solution: {
                explanation: solution.explanation ?? "",
                payload: { correctAnswer: solution.correctAnswer },
              },
            }
          : solution,
    } as RoomMemberReviewReadRow;
    const original = structuredClone(row);
    const question = after(row);
    expect(question).toMatchObject({
      id: "item-id",
      type: test.document.type,
      timeLimit: test.document.timeLimitMs / 1000,
      points: 50,
      explanation: solution.explanation,
    });
    expect(row).toEqual(original);
    const envelopeRow = {
      ...row,
      public_payload: {
        category: publicPayload.category,
        tags: publicPayload.tags,
        prompt: publicPayload.question,
        context: null,
        timeLimitMs: test.document.timeLimitMs,
        payload: Object.fromEntries(
          Object.entries(publicPayload).filter(
            ([key]) => !["category", "tags", "question"].includes(key),
          ),
        ),
      },
      solution_payload: {
        solution: {
          explanation: solution.explanation,
          payload: Object.fromEntries(
            Object.entries(solution).filter(([key]) => key !== "explanation"),
          ),
        },
      },
    };
    expect(after(envelopeRow)).toEqual(question);
    expect(() => after({ ...row, public_payload: null })).toThrow();
    expect(() => after({ ...row, solution_payload: null })).toThrow();
    expect(() => after({ ...row, payload_schema_version: 99 })).toThrow();
    expect(() => after({ ...row, solution_payload: { unknown: "invalid" } })).toThrow();
  });
});
