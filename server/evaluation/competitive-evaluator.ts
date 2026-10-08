import "server-only";

import type { EvaluationContext } from "@/application/ports/attempt-commands";
import type { CompetitiveEvaluator } from "@/application/ports/competitive-evaluator";
import { normalizeCompetitiveEvaluationContext } from "@/infrastructure/supabase/attempts/normalize-competitive-context";
import { evaluateCompetitiveReceipt } from "@/server/evaluation/evaluate-receipt";
import { resolveCompetitiveQuestion } from "@/server/evaluation/resolve-competitive-question";
import type { AnswerValue } from "@/types/contracts";

export const supabaseCompetitiveEvaluator: CompetitiveEvaluator = {
  evaluate(context: EvaluationContext) {
    if (context.mode === "pyramid" && context.answer === null) {
      return { status: "unanswered", points: 0 };
    }

    const result = evaluateCompetitiveReceipt({
      receipt: {
        timeUsedMs: context.timeUsedMs,
        timedOut: context.timedOut,
      },
      question: resolveCompetitiveQuestion(
        normalizeCompetitiveEvaluationContext(context, "authorized-runtime"),
      ),
      answer: (context.answer as AnswerValue | null) ?? null,
      submittedCodes: [...(context.submittedCodes ?? [])],
      progressiveCluesRevealed: context.progressiveCluesRevealed ?? 1,
      progressiveClueAvailablePoints: context.progressiveClueAvailablePoints,
      matchingIncorrectAttempts: context.matchingIncorrectAttempts ?? 0,
      incorrectAttempts: context.incorrectAttempts ?? 0,
    });

    return {
      status: result.status,
      points: result.points,
      ...(result.details ? { details: result.details } : {}),
    };
  },
};
