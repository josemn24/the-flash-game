import type {
  ActivateInteractionInput,
  ActivateInteractionResult,
  AttemptRecoverySnapshot,
  CompleteAttemptInput,
  FinishAttemptResult,
  PassInteractionInput,
  PassInteractionResult,
  PrepareInteractionInput,
  PrepareInteractionResult,
  ReceiveAnswerResult,
  RecoverAttemptInput,
  RecoverAttemptResult,
  SaveQueensDraftInput,
  SaveQueensDraftResult,
  StartAttemptInput,
  StartAttemptResult,
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
  AttemptCommandInput,
  PrepareAttemptSessionInput,
  PrepareAttemptSessionResult,
} from "@/types/contracts/attempts";
import type { AuthenticatedActor } from "@/application/ports/actors";

export type StartAttemptUseCaseInput = StartAttemptInput & {
  readonly sessionToken?: string;
};

export type StartAttemptUseCaseResult = {
  readonly result: StartAttemptResult;
  readonly sessionToken: string;
};

export type SubmitAnswerUseCaseResult = {
  readonly received: ReceiveAnswerResult;
  readonly evaluated: SubmitAnswerResult;
};

export type RecoveryUseCaseResult = {
  readonly recovery: RecoverAttemptResult;
  readonly snapshot: AttemptRecoverySnapshot;
  readonly evaluated?: SubmitAnswerResult;
  readonly completed?: FinishAttemptResult;
};

export type FinishAttemptUseCaseResult = {
  readonly result: FinishAttemptResult;
  readonly scheduledChallengeId: string;
};

export interface AttemptUseCases {
  readonly actor: AuthenticatedActor;
  prepareSession(input: PrepareAttemptSessionInput): Promise<PrepareAttemptSessionResult>;
  start(input: StartAttemptUseCaseInput): Promise<StartAttemptUseCaseResult>;
  prepare(input: PrepareInteractionInput): Promise<PrepareInteractionResult>;
  activate(input: ActivateInteractionInput): Promise<ActivateInteractionResult>;
  submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerUseCaseResult>;
  recover(input: RecoverAttemptInput): Promise<RecoveryUseCaseResult>;
  complete(input: CompleteAttemptInput): Promise<FinishAttemptUseCaseResult>;
  abandon(input: AttemptCommandInput): Promise<FinishAttemptUseCaseResult>;
  pass(input: PassInteractionInput): Promise<PassInteractionResult>;
  submitMiniWordleGuess(input: SubmitMiniWordleGuessInput): Promise<SubmitMiniWordleGuessResult>;
  submitLogicCodeAttempt(input: SubmitLogicCodeAttemptInput): Promise<SubmitLogicCodeAttemptResult>;
  submitWordSearchSelection(
    input: SubmitWordSearchSelectionInput,
  ): Promise<SubmitWordSearchSelectionResult>;
  submitWordHashtagSwap(input: SubmitWordHashtagSwapInput): Promise<SubmitWordHashtagSwapResult>;
  submitQueensPlacement(input: SubmitQueensPlacementInput): Promise<SubmitQueensPlacementResult>;
  saveQueensDraft(input: SaveQueensDraftInput): Promise<SaveQueensDraftResult>;
  validateQueensBoard(input: ValidateQueensBoardInput): Promise<ValidateQueensBoardResult>;
  revealProgressiveClue(input: RevealProgressiveClueInput): Promise<RevealProgressiveClueResult>;
}
