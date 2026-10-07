import { assertAttemptLifecycle } from "@/lib/attemptLifecycle";
import { describe, expect, it, vi } from "vitest";
import type { AttemptCommands, EvaluationContext } from "@/application/ports/attempt-commands";
import type { CompetitiveEvaluator } from "@/application/ports/competitive-evaluator";
import type { PrivateQuestionAssetResolver } from "@/application/ports/private-question-assets";
import {
  ApplicationAttemptUseCases,
  type AttemptUseCaseDependencies,
} from "@/application/use-cases/attempts";
import type { AttemptRecoverySnapshot, SubmitAnswerInput } from "@/types/contracts/attempts";
import { supabaseCompetitiveEvaluator } from "@/server/evaluation/competitive-evaluator";

const attemptId = "11111111-1111-4111-8111-111111111111" as SubmitAnswerInput["attemptId"];
const challengeItemId =
  "22222222-2222-4222-8222-222222222222" as SubmitAnswerInput["challengeItemId"];
const receiptId = "33333333-3333-4333-8333-333333333333" as EvaluationContext["receiptId"];

function snapshot(overrides: Partial<AttemptRecoverySnapshot> = {}): AttemptRecoverySnapshot {
  const value = {
    challengeMode: "flash" as const,
    outcome: null,
    attemptId,
    scheduledChallengeId:
      "44444444-4444-4444-8444-444444444444" as AttemptRecoverySnapshot["scheduledChallengeId"],
    status: "in_progress",
    lockVersion: 3,
    hasStartedInteraction: true,
    allItemsResolved: false,
    answers: [],
    ...overrides,
  };
  assertAttemptLifecycle(value);
  return value;
}

function evaluationContext(): EvaluationContext {
  return {
    receiptId,
    answer: "answer",
    receivedAt: "2026-09-30T10:00:00.000Z" as EvaluationContext["receivedAt"],
    timeUsedMs: 500 as EvaluationContext["timeUsedMs"],
    timedOut: false,
    questionVersionId:
      "55555555-5555-4555-8555-555555555555" as EvaluationContext["questionVersionId"],
    questionType: "short-text",
    payloadSchemaVersion: 1,
    itemConfigSchemaVersion: 1,
    publicPayload: { question: "Question" },
    solutionPayload: { answer: "answer" },
    timeLimitMs: 10_000 as EvaluationContext["timeLimitMs"],
    itemPoints: 10,
    itemConfig: {},
    mode: "flash",
    modeConfigSchemaVersion: 1,
    modeConfig: {},
  };
}

function createUseCases(overrides: Partial<AttemptUseCaseDependencies> = {}) {
  const commands = {
    prepareSession: vi.fn(),
    readRecordedEvaluation: vi.fn().mockResolvedValue(null),
    start: vi.fn(),
    takeOver: vi.fn(),
    prepare: vi.fn(),
    activate: vi.fn(),
    receiveAnswer: vi.fn(),
    submitMiniWordleGuess: vi.fn(),
    submitLogicCodeAttempt: vi.fn(),
    submitWordSearchSelection: vi.fn(),
    submitWordHashtagSwap: vi.fn(),
    submitQueensPlacement: vi.fn(),
    saveQueensDraft: vi.fn(),
    validateQueensBoard: vi.fn(),
    revealProgressiveClue: vi.fn(),
    readEvaluationContext: vi.fn(),
    pass: vi.fn(),
    recordEvaluation: vi.fn(),
    completeFromPersistedAnswers: vi.fn(),
    recover: vi.fn(),
    readAttemptContext: vi.fn().mockResolvedValue({
      challengeMode: "alphabet",
      scheduledChallengeId: snapshot().scheduledChallengeId,
    }),
    readRecovery: vi.fn(),
    abandon: vi.fn(),
  } as unknown as AttemptCommands;
  const evaluator: CompetitiveEvaluator = {
    evaluate: vi.fn(() => ({ status: "correct" as const, points: 7 })),
  };
  const privateQuestionAssets: PrivateQuestionAssetResolver = {
    resolve: vi.fn(async ({ publicPayload }) => publicPayload),
  };
  const useCases = new ApplicationAttemptUseCases({
    actor: { authUserId: "auth-user" },
    commands,
    evaluator,
    privateQuestionAssets,
    sessionTokens: { generate: () => "generated-token" },
    ...overrides,
  });
  return { commands, evaluator, privateQuestionAssets, useCases };
}

const answerInput: SubmitAnswerInput = {
  attemptId,
  sessionToken: "session-token",
  lockVersion: 3,
  idempotencyKey: "answer-idempotency",
  challengeItemId,
  answer: "answer",
};

describe("ApplicationAttemptUseCases", () => {
  it("passes the candidate token only to the takeover command and returns it for cookie rotation", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.takeOver).mockResolvedValue({
      attemptId,
      sessionId: "66666666-6666-4666-8666-666666666666" as never,
      lockVersion: 4,
      deadlineAt: null,
      transferred: true,
    });

    const result = await useCases.takeOver({
      attemptId,
      scheduledChallengeId: snapshot().scheduledChallengeId,
      lockVersion: 3,
      idempotencyKey: "takeover:key",
      sessionToken: "candidate-token",
    });

    expect(commands.takeOver).toHaveBeenCalledWith({
      attemptId,
      scheduledChallengeId: snapshot().scheduledChallengeId,
      lockVersion: 3,
      idempotencyKey: "takeover:key",
      newSessionToken: "candidate-token",
    });
    expect(result.sessionToken).toBe("candidate-token");
    expect(result.result.transferred).toBe(true);
  });

  it("scores a pending Alphabet receipt outside the atomic completion command", async () => {
    const { commands, evaluator, useCases } = createUseCases();
    vi.mocked(commands.readRecovery).mockResolvedValue(
      snapshot({ challengeMode: "alphabet", pendingReceiptId: receiptId }),
    );
    vi.mocked(commands.readEvaluationContext).mockResolvedValue({
      ...evaluationContext(),
      mode: "alphabet",
    });
    vi.mocked(commands.completeFromPersistedAnswers).mockResolvedValue({
      attemptId,
      lockVersion: 4,
      status: "completed",
      challengeMode: "alphabet",
      outcome: null,
      score: 7,
      answers: [],
    });
    const input = {
      attemptId,
      sessionToken: "session-token",
      lockVersion: 3,
      idempotencyKey: "close",
    };
    await useCases.complete(input);
    expect(commands.recordEvaluation).not.toHaveBeenCalled();
    expect(commands.completeFromPersistedAnswers).toHaveBeenCalledWith({
      ...input,
      pendingEvaluation: { receiptId, status: "correct", points: 7 },
    });
    expect(vi.mocked(evaluator.evaluate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(commands.completeFromPersistedAnswers).mock.invocationCallOrder[0],
    );
  });

  it("completes expired Alphabet recovery without preparing or closing individual letters", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.readRecovery).mockResolvedValue(
      snapshot({ challengeMode: "alphabet", deadlineReached: true }),
    );
    const answers = [
      {
        challengeItemId,
        answer: null,
        status: "unanswered" as const,
        points: 0,
        timeUsedMs: 0 as never,
      },
    ];
    vi.mocked(commands.completeFromPersistedAnswers).mockResolvedValue({
      attemptId,
      lockVersion: 4,
      status: "completed",
      challengeMode: "alphabet",
      outcome: null,
      score: 0,
      answers,
    });
    const result = await useCases.recover(answerInput);
    expect(commands.recover).not.toHaveBeenCalled();
    expect(commands.receiveAnswer).not.toHaveBeenCalled();
    expect(result.snapshot.answers).toEqual(answers);
    expect(result.completed?.status).toBe("completed");
  });
  it("generates a token for a new attempt and reuses the supplied token on retry", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.start).mockResolvedValue({
      attemptId,
      sessionId: "66666666-6666-4666-8666-666666666666" as never,
      resumed: false,
      controlRequired: false,
      deadlineAt: null,
      lockVersion: 1,
    });

    const fresh = await useCases.start({
      scheduledChallengeId: "44444444-4444-4444-8444-444444444444" as never,
      idempotencyKey: "start-key",
    });
    const resumed = await useCases.start({
      scheduledChallengeId: "44444444-4444-4444-8444-444444444444" as never,
      idempotencyKey: "start-key",
      sessionToken: "existing-token",
    });

    expect(fresh.sessionToken).toBe("generated-token");
    expect(resumed.sessionToken).toBe("existing-token");
    expect(commands.start).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sessionToken: "generated-token" }),
    );
    expect(commands.start).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sessionToken: "existing-token" }),
    );
  });

  it("receives before evaluating, resolves private assets, and records idempotently", async () => {
    const { commands, evaluator, privateQuestionAssets, useCases } = createUseCases();
    vi.mocked(commands.readAttemptContext).mockResolvedValue({
      challengeMode: "alphabet",
      scheduledChallengeId: snapshot().scheduledChallengeId,
    });
    vi.mocked(commands.receiveAnswer).mockResolvedValue({
      attemptId,
      lockVersion: 4,
      receiptId,
      timedOut: false,
      timeUsedMs: 500 as never,
      receivedAt: "2026-09-30T10:00:00.000Z" as never,
      presentedAt: "2026-09-30T09:59:59.500Z" as never,
    });
    vi.mocked(commands.readEvaluationContext).mockResolvedValue(evaluationContext());
    vi.mocked(commands.recordEvaluation).mockResolvedValue({
      attemptId,
      lockVersion: 5,
      receiptId,
      status: "correct",
      points: 7,
    });

    const result = await useCases.submitAnswer(answerInput);

    expect(commands.readAttemptContext).toHaveBeenCalledWith(attemptId, answerInput.sessionToken);
    expect(commands.readRecovery).not.toHaveBeenCalled();
    expect(commands.receiveAnswer).toHaveBeenCalledWith(answerInput);
    expect(privateQuestionAssets.resolve).toHaveBeenCalledOnce();
    expect(evaluator.evaluate).toHaveBeenCalledOnce();
    expect(vi.mocked(commands.receiveAnswer).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(commands.readEvaluationContext).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(commands.readEvaluationContext).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(evaluator.evaluate).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(evaluator.evaluate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(commands.recordEvaluation).mock.invocationCallOrder[0],
    );
    expect(commands.recordEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId,
        lockVersion: 4,
        idempotencyKey: `evaluation:${receiptId}`,
        status: "correct",
        points: 7,
      }),
    );
    expect(result.evaluated.lockVersion).toBe(5);
  });

  it("applies the mode action guard to answers and passes without exposing it to routes", async () => {
    const beforeInteractiveAction = vi.fn();
    const { commands, useCases } = createUseCases({ beforeInteractiveAction });
    vi.mocked(commands.readAttemptContext).mockResolvedValue({
      challengeMode: "alphabet",
      scheduledChallengeId: snapshot().scheduledChallengeId,
    });
    vi.mocked(commands.receiveAnswer).mockResolvedValue({
      attemptId,
      lockVersion: 4,
      receiptId,
      timedOut: false,
      timeUsedMs: 500 as never,
      receivedAt: "2026-09-30T10:00:00.000Z" as never,
      presentedAt: "2026-09-30T09:59:59.500Z" as never,
    });
    vi.mocked(commands.readEvaluationContext).mockResolvedValue(evaluationContext());
    vi.mocked(commands.recordEvaluation).mockResolvedValue({
      attemptId,
      lockVersion: 5,
      receiptId,
      status: "correct",
      points: 7,
    });
    vi.mocked(commands.pass).mockResolvedValue({ attemptId, lockVersion: 5, passed: true });

    await useCases.submitAnswer(answerInput);
    await useCases.pass({ ...answerInput, challengeItemId });

    expect(beforeInteractiveAction).toHaveBeenCalledTimes(2);
    expect(beforeInteractiveAction).toHaveBeenNthCalledWith(1, {
      attemptId,
      challengeMode: "alphabet",
    });
    expect(commands.pass).toHaveBeenCalledOnce();
  });

  it.each(["submitAnswer", "pass"] as const)(
    "stops %s before writes or scoring when the guard rejects",
    async (operation) => {
      const denied = new Error("rate limit");
      const { commands, evaluator, useCases } = createUseCases({
        beforeInteractiveAction: () => {
          throw denied;
        },
      });
      await expect(useCases[operation](answerInput)).rejects.toBe(denied);
      expect(commands.readAttemptContext).toHaveBeenCalledOnce();
      expect(commands.readRecovery).not.toHaveBeenCalled();
      expect(commands.receiveAnswer).not.toHaveBeenCalled();
      expect(commands.pass).not.toHaveBeenCalled();
      expect(commands.readEvaluationContext).not.toHaveBeenCalled();
      expect(commands.recordEvaluation).not.toHaveBeenCalled();
      expect(evaluator.evaluate).not.toHaveBeenCalled();
    },
  );

  it("evaluates a pending recovery receipt and completes a terminal recovery from persisted answers", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.recover).mockResolvedValue({
      attemptId,
      lockVersion: 6,
      receiptId,
      recovered: true,
    });
    vi.mocked(commands.readEvaluationContext).mockResolvedValue(evaluationContext());
    vi.mocked(commands.readRecovery).mockResolvedValue(
      snapshot({ lockVersion: 6, allItemsResolved: true, terminalOutcome: "survived" }),
    );
    vi.mocked(commands.recordEvaluation).mockResolvedValue({
      attemptId,
      lockVersion: 7,
      receiptId,
      status: "correct",
      points: 7,
    });
    vi.mocked(commands.completeFromPersistedAnswers).mockResolvedValue({
      attemptId,
      lockVersion: 8,
      status: "completed",
      score: 7,
      challengeMode: "survival",
      outcome: "survived",
    });

    const result = await useCases.recover({ ...answerInput, idempotencyKey: "recover-key" });

    expect(result.evaluated?.status).toBe("correct");
    expect(result.completed?.score).toBe(7);
    expect(commands.completeFromPersistedAnswers).toHaveBeenCalledWith(
      expect.objectContaining({
        lockVersion: 6,
        idempotencyKey: `recovery:complete:${attemptId}`,
      }),
    );
  });

  it("recovers and scores a frozen survival image receipt with an old caption", async () => {
    const { commands, useCases } = createUseCases({ evaluator: supabaseCompetitiveEvaluator });
    vi.mocked(commands.recover).mockResolvedValue({
      attemptId,
      lockVersion: 6,
      receiptId,
      recovered: true,
    });
    vi.mocked(commands.readEvaluationContext).mockResolvedValue({
      ...evaluationContext(),
      questionType: "progressive-image",
      payloadSchemaVersion: 2,
      mode: "survival",
      modeConfig: { lives: 3 },
      answer: "Sagrada Familia",
      publicPayload: {
        question: "Identifica el monumento que aparece.",
        surface: {
          src: "https://example.supabase.co/signed/image.jpg?token=test",
          alt: "Fotografía de la Sagrada Familia vista desde el Parc Güell",
          width: 1920,
          height: 1271,
        },
        revealDurationMs: 7_000,
      },
      solutionPayload: {
        correctAnswer: "Sagrada Familia",
        acceptedAnswers: ["sagrada familia"],
        solutionAlt: "La Sagrada Familia de Barcelona",
      },
    });
    vi.mocked(commands.recordEvaluation).mockResolvedValue({
      attemptId,
      lockVersion: 7,
      receiptId,
      status: "correct",
      points: 10,
    });
    vi.mocked(commands.readRecovery).mockResolvedValue(
      snapshot({ challengeMode: "survival", lockVersion: 7 }),
    );

    const result = await useCases.recover({ ...answerInput, idempotencyKey: "recover-image" });

    expect(result.evaluated?.status).toBe("correct");
    expect(commands.recordEvaluation).toHaveBeenCalledWith({
      attemptId,
      sessionToken: answerInput.sessionToken,
      lockVersion: 6,
      idempotencyKey: `recovery:evaluation:${receiptId}`,
      receiptId,
      status: "correct",
      points: 10,
    });
    expect(commands.receiveAnswer).not.toHaveBeenCalled();
    expect(commands.completeFromPersistedAnswers).not.toHaveBeenCalled();
    expect(result.snapshot.lockVersion).toBe(7);
  });

  it("returns a non-terminal recovery without attempting completion", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.recover).mockResolvedValue({
      attemptId,
      lockVersion: 4,
      receiptId: null,
      recovered: false,
    });
    vi.mocked(commands.readRecovery).mockResolvedValue(
      snapshot({ lockVersion: 4, allItemsResolved: false, challengeMode: "flash" }),
    );

    const result = await useCases.recover({ ...answerInput, idempotencyKey: "recover-key" });

    expect(result.completed).toBeUndefined();
    expect(result.snapshot.allItemsResolved).toBe(false);
    expect(commands.readRecovery).toHaveBeenCalledTimes(2);
    expect(commands.readAttemptContext).not.toHaveBeenCalled();
    expect(commands.completeFromPersistedAnswers).not.toHaveBeenCalled();
  });

  it("uses the current lock version when completing and abandoning", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.readAttemptContext).mockResolvedValue({
      challengeMode: "flash",
      scheduledChallengeId: snapshot().scheduledChallengeId,
    });
    vi.mocked(commands.completeFromPersistedAnswers).mockResolvedValue({
      attemptId,
      lockVersion: 10,
      status: "completed",
      challengeMode: "flash",
      outcome: null,
      score: 10,
    });
    vi.mocked(commands.abandon).mockResolvedValue({
      attemptId,
      lockVersion: 11,
      status: "abandoned",
      challengeMode: "flash",
      outcome: null,
      score: null,
    });

    const complete = await useCases.complete({ ...answerInput, lockVersion: 9 });
    const abandon = await useCases.abandon({ ...answerInput, lockVersion: 10 });

    expect(commands.readAttemptContext).toHaveBeenCalledTimes(2);
    expect(commands.readRecovery).not.toHaveBeenCalled();
    expect(complete.scheduledChallengeId).toBe(snapshot().scheduledChallengeId);
    expect(commands.completeFromPersistedAnswers).toHaveBeenCalledWith({
      ...answerInput,
      lockVersion: 9,
    });
    expect(abandon.scheduledChallengeId).toBe(snapshot().scheduledChallengeId);
    expect(commands.abandon).toHaveBeenCalledWith({ ...answerInput, lockVersion: 10 });
  });

  it("delegates special formats and evaluates terminal receipts", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.readEvaluationContext).mockResolvedValue(evaluationContext());
    vi.mocked(commands.recordEvaluation).mockResolvedValue({
      attemptId,
      lockVersion: 5,
      receiptId,
      status: "correct",
      points: 7,
    });
    vi.mocked(commands.submitMiniWordleGuess).mockResolvedValue({
      attemptId,
      lockVersion: 4,
      challengeItemId,
      sequence: 1,
      guess: "casa",
      feedback: [],
      attemptsUsed: 1,
      maxAttempts: 6,
      terminal: true,
      receiptId,
    });

    const result = await useCases.submitMiniWordleGuess({
      ...answerInput,
      guess: "casa",
    });

    expect(commands.submitMiniWordleGuess).toHaveBeenCalledOnce();
    expect(result.status).toBe("correct");
    expect(result.points).toBe(7);
    expect(commands.recordEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `evaluation:${receiptId}` }),
    );
  });
});

describe("durable receipt reconciliation", () => {
  it("returns a persisted evaluation without calling the evaluator again", async () => {
    const { commands, evaluator, useCases } = createUseCases();
    vi.mocked(commands.receiveAnswer).mockResolvedValue({ receiptId, lockVersion: 4 } as never);
    const saved = { attemptId, receiptId, lockVersion: 5, status: "correct", points: 7 } as const;
    vi.mocked(commands.readRecordedEvaluation).mockResolvedValue(saved);
    expect((await useCases.submitAnswer(answerInput)).evaluated).toEqual(saved);
    expect(evaluator.evaluate).not.toHaveBeenCalled();
    expect(commands.recordEvaluation).not.toHaveBeenCalled();
  });

  it.each(["stale_version", "already_evaluated", "idempotency_conflict"])(
    "reconciles %s when another request committed the evaluation",
    async (code) => {
      const { commands, useCases } = createUseCases();
      vi.mocked(commands.receiveAnswer).mockResolvedValue({ receiptId, lockVersion: 4 } as never);
      vi.mocked(commands.readEvaluationContext).mockResolvedValue(evaluationContext());
      const saved = { attemptId, receiptId, lockVersion: 6, status: "correct", points: 7 } as const;
      vi.mocked(commands.readRecordedEvaluation)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(saved);
      vi.mocked(commands.recordEvaluation).mockRejectedValue({ code });
      expect((await useCases.submitAnswer(answerInput)).evaluated).toEqual(saved);
      expect(commands.receiveAnswer).toHaveBeenCalledOnce();
      expect(commands.recordEvaluation).toHaveBeenCalledOnce();
    },
  );

  it("keeps a concurrency conflict when no evaluation has committed", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.receiveAnswer).mockResolvedValue({ receiptId, lockVersion: 4 } as never);
    vi.mocked(commands.readEvaluationContext).mockResolvedValue(evaluationContext());
    vi.mocked(commands.recordEvaluation).mockRejectedValue({ code: "stale_version" });
    await expect(useCases.submitAnswer(answerInput)).rejects.toMatchObject({
      code: "stale_version",
    });
    expect(commands.recordEvaluation).toHaveBeenCalledOnce();
  });
});
