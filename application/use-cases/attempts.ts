import type { AttemptCommands, EvaluationContext } from "@/application/ports/attempt-commands";
import type { AttemptSessionTokenGenerator } from "@/application/ports/actors";
import type { CompetitiveEvaluator } from "@/application/ports/competitive-evaluator";
import type { PrivateQuestionAssetResolver } from "@/application/ports/private-question-assets";
import type {
  AttemptUseCases,
  FinishAttemptUseCaseResult,
  RecoveryUseCaseResult,
  StartAttemptUseCaseInput,
  StartAttemptUseCaseResult,
  SubmitAnswerUseCaseResult,
} from "@/application/ports/attempt-use-cases";
import type {
  ActivateInteractionInput,
  ActivateInteractionResult,
  AttemptCommandInput,
  AttemptRecoverySnapshot,
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
    | "readRecovery"
    | "abandon"
  >;
  readonly evaluator: CompetitiveEvaluator;
  readonly privateQuestionAssets: PrivateQuestionAssetResolver;
  readonly sessionTokens: AttemptSessionTokenGenerator;
  readonly beforeInteractiveAction?: (input: {
    readonly attemptId: string;
    readonly challengeMode: AttemptRecoverySnapshot["challengeMode"];
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
  private readonly beforeInteractiveAction?: AttemptUseCaseDependencies["beforeInteractiveAction"];

  constructor(dependencies: AttemptUseCaseDependencies) {
    this.actor = dependencies.actor;
    this.commands = dependencies.commands;
    this.evaluator = dependencies.evaluator;
    this.privateQuestionAssets = dependencies.privateQuestionAssets;
    this.sessionTokens = dependencies.sessionTokens;
    this.beforeInteractiveAction = dependencies.beforeInteractiveAction;
  }

  async start(input: StartAttemptUseCaseInput): Promise<StartAttemptUseCaseResult> {
    const sessionToken = input.sessionToken ?? this.sessionTokens.generate();
    const result = await this.commands.start({ ...input, sessionToken });
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
    const snapshot = await this.commands.readRecovery(input.attemptId, input.sessionToken);
    this.beforeInteractiveAction?.({
      attemptId: input.attemptId,
      challengeMode: snapshot.challengeMode,
    });
    const received = await this.commands.receiveAnswer(input);
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

    const snapshot = await this.commands.readRecovery(input.attemptId, input.sessionToken);
    let completed: FinishAttemptResult | undefined;
    if (
      snapshot.allItemsResolved ||
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
      snapshot,
      ...(evaluated ? { evaluated } : {}),
      ...(completed ? { completed } : {}),
    };
  }

  async complete(input: CompleteAttemptInput): Promise<FinishAttemptUseCaseResult> {
    const snapshot = await this.commands.readRecovery(input.attemptId, input.sessionToken);
    const result = await this.commands.completeFromPersistedAnswers(input);
    return { result, scheduledChallengeId: snapshot.scheduledChallengeId };
  }

  async abandon(input: AttemptCommandInput): Promise<FinishAttemptUseCaseResult> {
    const snapshot = await this.commands.readRecovery(input.attemptId, input.sessionToken);
    const result = await this.commands.abandon(input);
    return { result, scheduledChallengeId: snapshot.scheduledChallengeId };
  }

  async pass(input: PassInteractionInput): Promise<PassInteractionResult> {
    const snapshot = await this.commands.readRecovery(input.attemptId, input.sessionToken);
    this.beforeInteractiveAction?.({
      attemptId: input.attemptId,
      challengeMode: snapshot.challengeMode,
    });
    return this.commands.pass(input);
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

  private async evaluateReceipt(input: {
    readonly attemptId: string;
    readonly sessionToken: string;
    readonly lockVersion: number;
    readonly receiptId: AnswerReceiptId;
    readonly idempotencyKey: string;
  }): Promise<SubmitAnswerResult> {
    const context = await this.commands.readEvaluationContext(input.receiptId, input.sessionToken);
    const resolvedContext: EvaluationContext = {
      ...context,
      publicPayload: (await this.privateQuestionAssets.resolve({
        authUserId: this.actor.authUserId,
        attemptId: input.attemptId,
        publicPayload: context.publicPayload,
      })) as EvaluationContext["publicPayload"],
    };
    const result = this.evaluator.evaluate(resolvedContext);
    const recorded = await this.commands.recordEvaluation({
      attemptId: input.attemptId as SubmitAnswerResult["attemptId"],
      sessionToken: input.sessionToken,
      lockVersion: input.lockVersion,
      idempotencyKey: input.idempotencyKey,
      receiptId: input.receiptId,
      status: result.status,
      points: result.points,
      ...(result.details ? { resultDetails: result.details } : {}),
    });
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
