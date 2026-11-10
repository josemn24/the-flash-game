import "server-only";

import type {
  SuperadminAnswerRegradePreview,
  SuperadminAnswerRegradeSelection,
  SuperadminApplyAnswerRegradeInput,
  PurgeTerminalAttemptInput,
  SuperadminAdjustResultInput,
  SuperadminAttemptCommandInput,
  SuperadminAttemptCommands,
  TimeoutCheckpointSelection,
  RecognizeTimeoutCheckpointInput,
} from "@/application/ports/superadmin-attempt-commands";
import type { CompetitiveEvaluator } from "@/application/ports/competitive-evaluator";
import { evaluateWithPublishedAcceptedAnswers } from "@/application/administration/evaluate-answer-regrade";
import type { AttemptAnswerRegradeContext } from "@/infrastructure/supabase/attempts/attemptCommandContracts";
import {
  callAttemptCommand,
  confirmAttemptAnswerRegrade,
  purgeTerminalAttempt,
  previewTimeoutCheckpoint,
  recognizeTimeoutCheckpoint,
  readAttemptAnswerRegradeContext,
  AttemptCommandError,
  type VerifiedAuthIdentity,
} from "@/infrastructure/supabase/attempts/attemptCommands";
import { isAttemptErrorCode } from "@/lib/competitiveErrors";

function evaluateRegrade(evaluator: CompetitiveEvaluator, context: AttemptAnswerRegradeContext) {
  try {
    return evaluateWithPublishedAcceptedAnswers(evaluator, context, context.acceptedAnswers);
  } catch (error) {
    if (error instanceof Error && isAttemptErrorCode(error.message)) {
      throw new AttemptCommandError(error.message, error);
    }
    throw error;
  }
}

export class SupabaseSuperadminAttemptCommands implements SuperadminAttemptCommands {
  constructor(
    private readonly identity: VerifiedAuthIdentity,
    private readonly evaluator: CompetitiveEvaluator,
  ) {}

  purge(input: PurgeTerminalAttemptInput) {
    return purgeTerminalAttempt(this.identity, input);
  }

  adjust(input: SuperadminAdjustResultInput) {
    return callAttemptCommand(this.identity, "adjust_result", input);
  }

  invalidate(input: SuperadminAttemptCommandInput) {
    return callAttemptCommand(this.identity, "invalidate_attempt", input);
  }

  previewTimeoutCheckpoint(input: TimeoutCheckpointSelection) {
    return previewTimeoutCheckpoint(this.identity, input);
  }

  recognizeTimeoutCheckpoint(input: RecognizeTimeoutCheckpointInput) {
    return recognizeTimeoutCheckpoint(this.identity, input);
  }

  async previewAnswerRegrade(
    input: SuperadminAnswerRegradeSelection,
  ): Promise<SuperadminAnswerRegradePreview> {
    const context = await readAttemptAnswerRegradeContext(this.identity, input);
    const evaluation = evaluateRegrade(this.evaluator, context);
    const difference = evaluation.points - context.currentPoints;
    const newEffectiveScore = context.effectiveScore + difference;
    if (newEffectiveScore < 0 || newEffectiveScore > 100)
      throw new AttemptCommandError("invalid_score");
    return {
      ...input,
      rubricVersionNumber: context.rubricVersionNumber,
      originalStatus: context.originalStatus,
      originalPoints: context.originalPoints,
      currentStatus: context.currentStatus,
      currentPoints: context.currentPoints,
      proposedStatus: evaluation.status,
      proposedPoints: evaluation.points,
      difference,
      currentEffectiveScore: context.effectiveScore,
      newEffectiveScore,
    };
  }

  regradeAnswer(input: SuperadminApplyAnswerRegradeInput) {
    return confirmAttemptAnswerRegrade(this.identity, input, (context) => {
      const evaluation = evaluateRegrade(this.evaluator, context);
      return {
        resultStatus: evaluation.status,
        resultPoints: evaluation.points,
        ...(evaluation.details ? { resultDetails: evaluation.details } : {}),
      };
    });
  }
}
