import {
  observePerformance,
  type PerformanceObserver,
} from "@/application/ports/performance-observer";
import type {
  AttemptCommands,
  AttemptContext,
  EvaluationContext,
} from "@/application/ports/attempt-commands";
import type { AttemptSessionTokenGenerator } from "@/application/ports/actors";
import type { CompetitiveEvaluator } from "@/application/ports/competitive-evaluator";
import type { PrivateQuestionAssetResolver } from "@/application/ports/private-question-assets";
import type {
  AttemptUseCases,
  FinishAttemptUseCaseResult,
  RecoveryUseCaseResult,
  StartAttemptUseCaseInput,
  StartAttemptUseCaseResult,
  TakeOverAttemptUseCaseInput,
  TakeOverAttemptUseCaseResult,
  SubmitAnswerUseCaseResult,
} from "@/application/ports/attempt-use-cases";
import type {
  ActivateInteractionInput,
  ActivateInteractionResult,
  AttemptCommandInput,
  CompleteAttemptInput,
  FinishAttemptResult,
  PassInteractionInput,
  PassInteractionResult,
  PrepareInteractionInput,
  PrepareInteractionResult,
  RecoverAttemptInput,
  SaveQueensDraftInput,
  SaveQueensDraftResult,
  SubmitAnswerInput,
  SubmitAnswerResult,
  SubmitLogicCodeAttemptInput,
  SubmitLogicCodeAttemptResult,
  SubmitMiniWordleGuessInput,
  SubmitMiniWordleGuessResult,
  SubmitQueensPlacementInput,
  SubmitQueensPlacementResult,
  SubmitWordHashtagSwapInput,
  SubmitWordHashtagSwapResult,
  SubmitWordSearchSelectionInput,
  SubmitWordSearchSelectionResult,
  PrepareAttemptSessionInput,
  PrepareAttemptSessionResult,
  ValidateQueensBoardInput,
  ValidateQueensBoardResult,
  RevealProgressiveClueInput,
  RevealProgressiveClueResult,
} from "@/types/contracts/attempts";
import type { AuthenticatedActor } from "@/application/ports/actors";
import type { AnswerReceiptId } from "@/types/domain/identifiers";

export type AttemptUseCaseDependencies = {
  readonly actor: AuthenticatedActor;
  readonly commands: Pick<
    AttemptCommands,
    | "start"
    | "takeOver"
    | "prepareSession"
    | "readRecordedEvaluation"
    | "prepare"
    | "activate"
    | "receiveAnswer"
    | "submitMiniWordleGuess"
    | "submitLogicCodeAttempt"
    | "submitWordSearchSelection"
    | "submitWordHashtagSwap"
    | "submitQueensPlacement"
    | "saveQueensDraft"
    | "validateQueensBoard"
    | "revealProgressiveClue"
    | "readEvaluationContext"
    | "pass"
    | "recordEvaluation"
    | "completeFromPersistedAnswers"
    | "recover"
    | "readAttemptContext"
    | "readRecovery"
    | "abandon"
  >;
  readonly evaluator: CompetitiveEvaluator;
  readonly privateQuestionAssets: PrivateQuestionAssetResolver;
  readonly sessionTokens: AttemptSessionTokenGenerator;
  readonly performanceObserver?: PerformanceObserver;
  readonly beforeInteractiveAction?: (input: {
    readonly attemptId: string;
    readonly challengeMode: AttemptContext["challengeMode"];
  }) => void;
};

type TerminalCommandResult = {
  readonly attemptId: string;
  readonly lockVersion: number;
  readonly terminal: boolean;
  readonly receiptId?: AnswerReceiptId;
};

export class ApplicationAttemptUseCases implements AttemptUseCases {
  readonly actor: AuthenticatedActor;

  private readonly commands: AttemptUseCaseDependencies["commands"];
  private readonly evaluator: CompetitiveEvaluator;
  private readonly privateQuestionAssets: PrivateQuestionAssetResolver;
  private readonly sessionTokens: AttemptSessionTokenGenerator;
  private readonly performanceObserver?: PerformanceObserver;
  private readonly beforeInteractiveAction?: AttemptUseCaseDependencies["beforeInteractiveAction"];

  constructor(dependencies: AttemptUseCaseDependencies) {
    this.actor = dependencies.actor;
    this.commands = dependencies.commands;
    this.evaluator = dependencies.evaluator;
    this.privateQuestionAssets = dependencies.privateQuestionAssets;
    this.sessionTokens = dependencies.sessionTokens;
    this.performanceObserver = dependencies.performanceObserver;
    this.beforeInteractiveAction = dependencies.beforeInteractiveAction;
  }

  async prepareSession(input: PrepareAttemptSessionInput): Promise<PrepareAttemptSessionResult> {
    await this.commands.prepareSession(input);
    return { ready: true };
  }

  async start(input: StartAttemptUseCaseInput): Promise<StartAttemptUseCaseResult> {
    const sessionToken = input.sessionToken ?? this.sessionTokens.generate();
    const result = await this.commands.start({ ...input, sessionToken });
    return { result, sessionToken };
  }

  async takeOver(input: TakeOverAttemptUseCaseInput): Promise<TakeOverAttemptUseCaseResult> {
    const { sessionToken, ...command } = input;
    const result = await this.commands.takeOver({ ...command, newSessionToken: sessionToken });
    return { result, sessionToken };
  }

  async prepare(input: PrepareInteractionInput): Promise<PrepareInteractionResult> {
    const prepared = await this.commands.prepare(input);
    if (!prepared.publicPayload) return prepared;
    return {
      ...prepared,
      publicPayload: (await this.privateQuestionAssets.resolve({
        authUserId: this.actor.authUserId,
        attemptId: input.attemptId,
        publicPayload: prepared.publicPayload,
      })) as PrepareInteractionResult["publicPayload"],
    };
  }

  activate(input: ActivateInteractionInput): Promise<ActivateInteractionResult> {
    return this.commands.activate(input);
  }

  async submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerUseCaseResult> {
    const context = await observePerformance(this.performanceObserver, "attempt.context", () =>
      this.commands.readAttemptContext(input.attemptId, input.sessionToken),
    );
    this.performanceObserver?.setMode(context.challengeMode);
    this.beforeInteractiveAction?.({
      attemptId: input.attemptId,
      challengeMode: context.challengeMode,
    });
    const received = await observePerformance(this.performanceObserver, "attempt.receive", () =>
      this.commands.receiveAnswer(input),
    );
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: received.lockVersion,
      receiptId: received.receiptId,
      idempotencyKey: `evaluation:${received.receiptId}`,
    });
    return { received, evaluated };
  }

  async recover(input: RecoverAttemptInput): Promise<RecoveryUseCaseResult> {
    this.performanceObserver?.recordRecovery?.("recovery_requested");
    const initial = await this.commands.readRecovery(input.attemptId, input.sessionToken);
    if (initial.challengeMode === "alphabet" && initial.deadlineReached) {
      const { result: completed } = await this.complete(input);
      return {
        recovery: {
          attemptId: input.attemptId,
          lockVersion: completed.lockVersion,
          receiptId: null,
          recovered: true,
        },
        snapshot: {
          ...initial,
          ...completed,
          lockVersion: completed.lockVersion,
          allItemsResolved: true,
          hasOpenInteraction: false,
          pendingReceiptId: null,
          answers: completed.answers ?? initial.answers,
        },
        completed,
      };
    }
    const recovery = await this.commands.recover(input);
    let evaluated: SubmitAnswerResult | undefined;
    if (recovery.receiptId) {
      evaluated = await this.evaluateReceipt({
        attemptId: input.attemptId,
        sessionToken: input.sessionToken,
        lockVersion: recovery.lockVersion,
        receiptId: recovery.receiptId,
        idempotencyKey: `recovery:evaluation:${recovery.receiptId}`,
      });
    }

    const snapshot = await observePerformance(this.performanceObserver, "attempt.context", () =>
      this.commands.readRecovery(input.attemptId, input.sessionToken),
    );
    if (snapshot.challengeMode) this.performanceObserver?.setMode(snapshot.challengeMode);
    let completed: FinishAttemptResult | undefined;
    if (
      snapshot.allItemsResolved ||
      (snapshot.challengeMode === "alphabet" && snapshot.deadlineReached) ||
      snapshot.terminalOutcome === "eliminated" ||
      snapshot.terminalOutcome === "failed"
    ) {
      completed = await this.commands.completeFromPersistedAnswers({
        attemptId: input.attemptId,
        sessionToken: input.sessionToken,
        lockVersion: snapshot.lockVersion,
        idempotencyKey: `recovery:complete:${input.attemptId}`,
      });
    }

    return {
      recovery,
      snapshot: completed ? {
        ...snapshot,
        ...completed,
        allItemsResolved: true,
        hasOpenInteraction: false,
        pendingReceiptId: null,
        answers: completed.answers ?? snapshot.answers,
      } : snapshot,
      ...(evaluated ? { evaluated } : {}),
      ...(completed ? { completed } : {}),
    };
  }

  async complete(input: CompleteAttemptInput): Promise<FinishAttemptUseCaseResult> {
    const context = await observePerformance(this.performanceObserver, "attempt.context", () =>
      this.commands.readAttemptContext(input.attemptId, input.sessionToken),
    );
    this.performanceObserver?.setMode(context.challengeMode);
    const snapshot =
      context.challengeMode === "alphabet"
        ? await this.commands.readRecovery(input.attemptId, input.sessionToken)
        : undefined;
    const pending = snapshot?.pendingReceiptId;
    const evaluation = pending
      ? await this.scoreReceipt({ ...input, receiptId: pending })
      : undefined;
    const result = await observePerformance(this.performanceObserver, "attempt.finish", () =>
      this.commands.completeFromPersistedAnswers({
        ...input,
        ...(pending && evaluation
          ? {
              pendingEvaluation: {
                receiptId: pending,
                status: evaluation.status,
                points: evaluation.points,
                ...(evaluation.details ? { resultDetails: evaluation.details } : {}),
              },
            }
          : {}),
      }),
    );
    return { result, scheduledChallengeId: context.scheduledChallengeId };
  }

  async abandon(input: AttemptCommandInput): Promise<FinishAttemptUseCaseResult> {
    const context = await observePerformance(this.performanceObserver, "attempt.context", () =>
      this.commands.readAttemptContext(input.attemptId, input.sessionToken),
    );
    this.performanceObserver?.setMode(context.challengeMode);
    const result = await observePerformance(this.performanceObserver, "attempt.finish", () =>
      this.commands.abandon(input),
    );
    return { result, scheduledChallengeId: context.scheduledChallengeId };
  }

  async pass(input: PassInteractionInput): Promise<PassInteractionResult> {
    const context = await observePerformance(this.performanceObserver, "attempt.context", () =>
      this.commands.readAttemptContext(input.attemptId, input.sessionToken),
    );
    this.performanceObserver?.setMode(context.challengeMode);
    this.beforeInteractiveAction?.({
      attemptId: input.attemptId,
      challengeMode: context.challengeMode,
    });
    return observePerformance(this.performanceObserver, "attempt.pass", () =>
      this.commands.pass(input),
    );
  }

  async submitMiniWordleGuess(
    input: SubmitMiniWordleGuessInput,
  ): Promise<SubmitMiniWordleGuessResult> {
    return this.evaluateTerminalCommand(input, await this.commands.submitMiniWordleGuess(input));
  }

  async submitLogicCodeAttempt(
    input: SubmitLogicCodeAttemptInput,
  ): Promise<SubmitLogicCodeAttemptResult> {
    return this.evaluateTerminalCommand(input, await this.commands.submitLogicCodeAttempt(input));
  }

  async submitWordSearchSelection(
    input: SubmitWordSearchSelectionInput,
  ): Promise<SubmitWordSearchSelectionResult> {
    return this.evaluateTerminalCommand(
      input,
      await this.commands.submitWordSearchSelection(input),
    );
  }

  async submitWordHashtagSwap(
    input: SubmitWordHashtagSwapInput,
  ): Promise<SubmitWordHashtagSwapResult> {
    return this.evaluateTerminalCommand(input, await this.commands.submitWordHashtagSwap(input));
  }

  async submitQueensPlacement(
    input: SubmitQueensPlacementInput,
  ): Promise<SubmitQueensPlacementResult> {
    return this.evaluateTerminalCommand(input, await this.commands.submitQueensPlacement(input));
  }

  saveQueensDraft(input: SaveQueensDraftInput): Promise<SaveQueensDraftResult> {
    return this.commands.saveQueensDraft(input);
  }

  async validateQueensBoard(input: ValidateQueensBoardInput): Promise<ValidateQueensBoardResult> {
    return this.evaluateTerminalCommand(input, await this.commands.validateQueensBoard(input));
  }

  revealProgressiveClue(input: RevealProgressiveClueInput): Promise<RevealProgressiveClueResult> {
    return this.commands.revealProgressiveClue(input);
  }

  private async scoreReceipt(input: {
    readonly attemptId: string;
    readonly sessionToken: string;
    readonly receiptId: AnswerReceiptId;
  }) {
    const context = await observePerformance(
      this.performanceObserver,
      "attempt.evaluation-context",
      () => this.commands.readEvaluationContext(input.receiptId, input.sessionToken),
    );
    this.performanceObserver?.setMode(context.mode);
    const resolvedContext: EvaluationContext = {
      ...context,
      publicPayload: (await observePerformance(this.performanceObserver, "attempt.assets", () =>
        this.privateQuestionAssets.resolve({
          authUserId: this.actor.authUserId,
          attemptId: input.attemptId,
          publicPayload: context.publicPayload,
        }),
      )) as EvaluationContext["publicPayload"],
    };
    return observePerformance(this.performanceObserver, "attempt.scoring", () =>
      this.evaluator.evaluate(resolvedContext),
    );
  }

  private async evaluateReceipt(input: {
    readonly attemptId: string;
    readonly sessionToken: string;
    readonly lockVersion: number;
    readonly receiptId: AnswerReceiptId;
    readonly idempotencyKey: string;
  }): Promise<SubmitAnswerResult> {
    const saved = await this.commands.readRecordedEvaluation(input.receiptId, input.sessionToken);
    if (saved) {
      this.performanceObserver?.recordRecovery?.("evaluation_replayed");
      return saved;
    }
    this.performanceObserver?.recordRecovery?.("receipt_pending");
    const result = await this.scoreReceipt(input);
    let recorded: SubmitAnswerResult;
    try {
      recorded = await observePerformance(this.performanceObserver, "attempt.record", () =>
        this.commands.recordEvaluation({
          attemptId: input.attemptId as SubmitAnswerResult["attemptId"],
          sessionToken: input.sessionToken,
          lockVersion: input.lockVersion,
          idempotencyKey: input.idempotencyKey,
          receiptId: input.receiptId,
          status: result.status,
          points: result.points,
          ...(result.details ? { resultDetails: result.details } : {}),
        }),
      );
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (["stale_version", "already_evaluated", "idempotency_conflict"].includes(String(code))) {
        const concurrent = await this.commands.readRecordedEvaluation(
          input.receiptId,
          input.sessionToken,
        );
        if (concurrent) {
          this.performanceObserver?.recordRecovery?.("evaluation_recovered");
          return concurrent;
        }
      }
      throw error;
    }
    return {
      ...recorded,
      ...(result.details ? { details: result.details } : {}),
    };
  }

  private async evaluateTerminalCommand<
    Input extends { readonly attemptId: string; readonly sessionToken: string },
    Result extends TerminalCommandResult,
  >(input: Input, accepted: Result): Promise<Result> {
    if (!accepted.terminal || !accepted.receiptId) return accepted;
    const evaluated = await this.evaluateReceipt({
      attemptId: input.attemptId,
      sessionToken: input.sessionToken,
      lockVersion: accepted.lockVersion,
      receiptId: accepted.receiptId,
      idempotencyKey: `evaluation:${accepted.receiptId}`,
    });
    return {
      ...accepted,
      lockVersion: evaluated.lockVersion,
      status: evaluated.status,
      points: evaluated.points,
      ...(evaluated.details ? { details: evaluated.details } : {}),
    } as Result;
  }
}
