import { describe, expect, it } from "vitest";
import {
  attemptSqlDecoders,
  type AttemptItemValidationContext,
  decodeEvaluationContext,
  decodeRecordedEvaluation,
} from "./attemptCommandContracts";
import { CompetitiveResponseContractError } from "@/lib/competitiveResponseContract";
import {
  formatProgress,
  initialFormatState,
} from "@/features/game/session/providers/localShared/formats";
import { compileDefinition } from "@/features/game/session/providers/localShared/definition";
import { definitionFor, sessionCases } from "@/test-utils/game-session-conformance/corpus";

const identity = { attemptId: "attempt", lockVersion: 2 };
const receipt = {
  ...identity,
  receiptId: "receipt",
  timedOut: false,
  timeUsedMs: 1200,
  receivedAt: "2026-10-01T10:00:02Z",
  presentedAt: "2026-10-01T10:00:00Z",
};
const start = {
  ...identity,
  sessionId: "controller",
  resumed: false,
  controlRequired: false,
  deadlineAt: null,
};
const evaluation = { ...identity, receiptId: "receipt", status: "correct", points: 12 };
const input = {
  attemptId: "attempt" as never,
  sessionToken: "secret",
  lockVersion: 1,
  idempotencyKey: "original",
  challengeItemId: "item" as never,
  answer: null,
  receiptId: "receipt" as never,
  status: "correct" as const,
  points: 12,
};

describe("mandatory SQL command decoders", () => {
  it.each([
    ["start_prepared_attempt", start],
    ["receive_answer", receipt],
    ["record_evaluation", evaluation],
  ] as const)("rejects missing, mistyped and contradictory %s fields", (name, valid) => {
    const decode = (value: unknown) =>
      attemptSqlDecoders[name](
        value,
        name === "start_prepared_attempt"
          ? ({
              scheduledChallengeId: "challenge" as never,
              idempotencyKey: "original",
              sessionToken: "secret",
            } as never)
          : (input as never),
      );
    expect(decode(valid)).toEqual(valid);
    for (const key of Object.keys(valid)) {
      const missing = { ...valid } as Record<string, unknown>;
      delete missing[key];
      expect(() => decode(missing), key).toThrow(CompetitiveResponseContractError);
      expect(() => decode({ ...valid, [key]: [] }), key).toThrow(CompetitiveResponseContractError);
    }
    expect(() => decode({ lockVersion: 2 })).toThrow();
    if (name !== "start_prepared_attempt")
      expect(() => decode({ ...valid, attemptId: "other" })).toThrow();
  });
  it("validates persisted evaluation reads rather than trusting a pg generic", () => {
    expect(decodeRecordedEvaluation(null, "receipt")).toBeNull();
    expect(decodeRecordedEvaluation(evaluation, "receipt")).toEqual(evaluation);
    for (const invalid of [
      undefined,
      {},
      { ...evaluation, receiptId: "other" },
      { ...evaluation, points: "12" },
      { ...evaluation, points: -1 },
    ])
      expect(() => decodeRecordedEvaluation(invalid, "receipt")).toThrow();
  });
  it("validates the private evaluation envelope without coercing diagnostics or exposing solutions", () => {
    expect(() => decodeEvaluationContext({ receiptId: "receipt" }, "receipt")).toThrow();
    const privateContext = {
      receiptId: "receipt",
      answer: null,
      receivedAt: receipt.receivedAt,
      timeUsedMs: 0,
      timedOut: true,
      questionVersionId: "question",
      questionType: "short-text",
      payloadSchemaVersion: 1,
      itemConfigSchemaVersion: 1,
      publicPayload: {},
      solutionPayload: { answer: "secret" },
      timeLimitMs: 1000,
      itemPoints: 10,
      itemConfig: {},
      mode: "flash",
      modeConfigSchemaVersion: 1,
      modeConfig: {},
      submittedCodes: null,
      incorrectAttempts: null,
    };
    expect(decodeEvaluationContext(privateContext, "receipt")).not.toHaveProperty("submittedCodes");
    expect(() =>
      decodeEvaluationContext({ ...privateContext, timeUsedMs: "0" }, "receipt"),
    ).toThrow();
  });
  it.each(sessionCases)(
    "validates preparation for $id and its published payload version",
    (example) => {
      const compiled = compileDefinition(definitionFor(example));
      const level = compiled.levels[0]!;
      const payload = structuredClone(level.publicPayload);
      if (level.question.type === "progressive-clues") {
        delete payload.clues;
        payload.clueCount = level.question.clues.length;
      }
      // Initial format progress is part of the public projection for stateful formats.
      const value = {
        ...identity,
        challengeItemId: level.source.challengeItemId,
        questionType: level.question.type,
        payloadSchemaVersion: level.source.payloadSchemaVersion,
        publicPayload: payload,
        presentedAt: null,
        deadlineAt: null,
        timedOut: false,
        progress: formatProgress(level, initialFormatState(level)),
      };
      const prepareInput = {
        attemptId: input.attemptId,
        sessionToken: input.sessionToken,
        lockVersion: input.lockVersion,
        idempotencyKey: input.idempotencyKey,
      };
      const context: AttemptItemValidationContext = {
        challengeItemId: value.challengeItemId,
        questionType: level.question.type,
        payloadSchemaVersion: value.payloadSchemaVersion!,
        mode: "pyramid",
        globalTimeLimitMs: null,
        timeLimitMs: example.document.timeLimitMs,
        points: level.question.points,
        publicPayload: level.publicPayload,
      };
      expect(attemptSqlDecoders.prepare_interaction(value, prepareInput, context)).toEqual(value);
      // Stateful progress is covered by provider conformance; this check exercises truncated envelopes for every format.
      expect(() =>
        attemptSqlDecoders.prepare_interaction(
          { ...value, payloadSchemaVersion: 0 },
          input,
          context,
        ),
      ).toThrow();
      expect(() =>
        attemptSqlDecoders.prepare_interaction({ ...value, publicPayload: null }, input, context),
      ).toThrow();
    },
  );
  it.each(Object.keys(attemptSqlDecoders))("%s never accepts a revision-only result", (name) => {
    expect(() =>
      attemptSqlDecoders[name as keyof typeof attemptSqlDecoders](
        { lockVersion: 2 },
        input as never,
      ),
    ).toThrow();
  });
});

describe("preparation uses the authorized item context", () => {
  const example = sessionCases.find(
    (v) => v.document.type === "progressive-image" && v.document.payloadSchemaVersion === 2,
  )!;
  const level = compileDefinition(definitionFor(example)).levels[0]!;
  it.each(["stored", "runtime"])(
    "validates %s images against their actual duration",
    (representation) => {
      const publicPayload = {
        ...(representation === "stored" ? example.document.publicPayload : level.publicPayload),
        revealDurationMs: 70000,
      };
      const value = {
        ...identity,
        challengeItemId: "item",
        questionType: "progressive-image",
        payloadSchemaVersion: 2,
        publicPayload,
        presentedAt: null,
        deadlineAt: null,
        timedOut: false,
      };
      const context: AttemptItemValidationContext = {
        challengeItemId: "item",
        questionType: "progressive-image",
        payloadSchemaVersion: 2,
        timeLimitMs: 90000,
        points: 14,
        mode: "flash",
        globalTimeLimitMs: null,
        publicPayload,
      };
      expect(attemptSqlDecoders.prepare_interaction(value, input, context)).toEqual(value);
      expect(() =>
        attemptSqlDecoders.prepare_interaction(value, input, { ...context, timeLimitMs: 30000 }),
      ).toThrow();
      expect(() =>
        attemptSqlDecoders.prepare_interaction(value, input, {
          ...context,
          payloadSchemaVersion: 1,
        }),
      ).toThrow();
      expect(() =>
        attemptSqlDecoders.prepare_interaction(value, input, {
          ...context,
          challengeItemId: "other",
        }),
      ).toThrow();
    },
  );
  it("rejects malformed Hashtag receipts before evaluation", () => {
    const hash = compileDefinition(
      definitionFor(sessionCases.find((v) => v.document.type === "word-hashtag")!),
    ).levels[0]!;
    const context: AttemptItemValidationContext = {
      challengeItemId: "item",
      questionType: "word-hashtag",
      payloadSchemaVersion: 1,
      timeLimitMs: 60000,
      points: 14,
      mode: "flash",
      globalTimeLimitMs: null,
      publicPayload: hash.publicPayload,
    };
    const progress = formatProgress(hash, initialFormatState(hash)) as Record<string, unknown>;
    const value = {
      ...identity,
      ...progress,
      challengeItemId: "item",
      terminal: false,
      movesUsed: 1,
      movesRemaining: Number(hash.publicPayload.maxMoves) - 1,
    };
    expect(
      attemptSqlDecoders.submit_word_hashtag_swap(
        value,
        { ...input, fromCell: 1, toCell: 3 },
        context,
      ),
    ).toEqual(value);
    for (const patch of [
      { letters: [] },
      { correctCells: undefined },
      { movesRemaining: 999 },
      { movesUsed: 0, movesRemaining: Number(hash.publicPayload.maxMoves) },
    ])
      expect(() =>
        attemptSqlDecoders.submit_word_hashtag_swap(
          { ...value, ...patch },
          { ...input, fromCell: 1, toCell: 3 },
          context,
        ),
      ).toThrow();
  });
});
