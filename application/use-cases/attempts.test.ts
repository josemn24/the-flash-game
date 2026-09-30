import { describe, expect, it, vi } from "vitest";
import type { AttemptCommands, EvaluationContext } from "@/application/ports/attempt-commands";
import type { CompetitiveEvaluator } from "@/application/ports/competitive-evaluator";
import type { PrivateQuestionAssetResolver } from "@/application/ports/private-question-assets";
import {
  ApplicationAttemptUseCases,
  type AttemptUseCaseDependencies,
} from "@/application/use-cases/attempts";
import type { AttemptRecoverySnapshot, SubmitAnswerInput } from "@/types/contracts/attempts";

const attemptId = "11111111-1111-4111-8111-111111111111" as SubmitAnswerInput["attemptId"];
const challengeItemId =
  "22222222-2222-4222-8222-222222222222" as SubmitAnswerInput["challengeItemId"];
const receiptId = "33333333-3333-4333-8333-333333333333" as EvaluationContext["receiptId"];

function snapshot(overrides: Partial<AttemptRecoverySnapshot> = {}): AttemptRecoverySnapshot {
  return {
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
    start: vi.fn(),
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
    vi.mocked(commands.readRecovery).mockResolvedValue(snapshot({ challengeMode: "alphabet" }));
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

    expect(commands.receiveAnswer).toHaveBeenCalledWith(answerInput);
    expect(privateQuestionAssets.resolve).toHaveBeenCalledOnce();
    expect(evaluator.evaluate).toHaveBeenCalledOnce();
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
    vi.mocked(commands.readRecovery).mockResolvedValue(snapshot({ challengeMode: "alphabet" }));
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
    expect(commands.completeFromPersistedAnswers).not.toHaveBeenCalled();
  });

  it("uses the current lock version when completing and abandoning", async () => {
    const { commands, useCases } = createUseCases();
    vi.mocked(commands.readRecovery).mockResolvedValue(snapshot({ lockVersion: 9 }));
    vi.mocked(commands.completeFromPersistedAnswers).mockResolvedValue({
      attemptId,
      lockVersion: 10,
      status: "completed",
      score: 10,
    });
    vi.mocked(commands.abandon).mockResolvedValue({
      attemptId,
      lockVersion: 11,
      status: "abandoned",
      score: null,
    });

    const complete = await useCases.complete({ ...answerInput, lockVersion: 9 });
    const abandon = await useCases.abandon({ ...answerInput, lockVersion: 10 });

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
