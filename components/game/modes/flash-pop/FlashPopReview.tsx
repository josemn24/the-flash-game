"use client";

import { ReviewAnswerPanel } from "@/components/game/shared";
import {
  isPyramidLevelPassed,
  type PyramidAttemptSummary,
} from "@/features/pyramid/pyramidAttempt";
import type { AnswerResult, PyramidChallenge, Question } from "@/types/game";

export type PyramidReviewLevel = {
  id: string;
  resultQuestionId: string;
  label: string;
  briefingTitle: string;
  question?: Question;
};

export function FlashPopReview({
  challenge,
  results,
  summary,
  onBack,
  onReplay,
  levelMetadata,
  totalLevelCount,
}: {
  challenge: PyramidChallenge;
  results: AnswerResult[];
  summary: PyramidAttemptSummary;
  onBack: () => void;
  onReplay?: () => void;
  levelMetadata?: readonly PyramidReviewLevel[];
  totalLevelCount?: number;
}) {
  const resultByQuestionId = new Map(results.map((result) => [result.questionId, result]));
  const levels =
    levelMetadata ??
    challenge.levels.map((level) => ({
      id: level.id,
      resultQuestionId: level.question.id,
      label: level.label,
      briefingTitle: level.briefing.title,
      question: level.question,
    }));
  const entries = levels.map((level, index) => {
    const result = resultByQuestionId.get(level.resultQuestionId);
    const passed = result ? isPyramidLevelPassed(result) : false;

    return {
      id: level.id,
      question: level.question,
      result,
      marker: String(index + 1).padStart(2, "0"),
      title: level.label,
      subtitle: level.briefingTitle,
      status: !result ? ("locked" as const) : passed ? ("correct" as const) : result.status,
      statusLabel: !result
        ? "No alcanzado"
        : result.status === "unanswered"
          ? "Sin responder"
          : passed
            ? "Superado"
            : result.status === "partial"
              ? "Parcial"
              : "Incorrecta",
      lockedMessage: "No alcanzado: el ascenso terminó en un nivel anterior.",
    };
  });

  return (
    <ReviewAnswerPanel
      entries={entries}
      countLabel={`${summary.levelsCleared} de ${totalLevelCount ?? challenge.levels.length} superados`}
      progress={{
        value: summary.levelsCleared,
        max: totalLevelCount ?? challenge.levels.length,
      }}
      backAtTop
      title="Historial de respuestas"
      onBack={onBack}
      onReplay={onReplay}
    />
  );
}
