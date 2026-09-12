"use client";

import { ReviewAnswerPanel } from "@/components/game/shared";
import { isPyramidLevelPassed, type PyramidAttemptSummary } from "@/features/pyramid/pyramidAttempt";
import type { AnswerResult, PyramidChallenge } from "@/types/game";

export function FlashPopReview({
  challenge,
  results,
  summary,
  onBack,
  onReplay,
}: {
  challenge: PyramidChallenge;
  results: AnswerResult[];
  summary: PyramidAttemptSummary;
  onBack: () => void;
  onReplay: () => void;
}) {
  const resultByQuestionId = new Map(results.map((result) => [result.questionId, result]));
  const entries = challenge.levels.map((level, index) => {
    const result = resultByQuestionId.get(level.question.id);
    const passed = result ? isPyramidLevelPassed(result) : false;

    return {
      id: level.id,
      question: level.question,
      result,
      marker: String(index + 1).padStart(2, "0"),
      title: level.label,
      subtitle: level.briefing.title,
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
      countLabel={`${summary.levelsCleared}/${challenge.levels.length} niveles`}
      title="Historial de respuestas"
      description="Consulta cada nivel alcanzado y descubre dónde terminó tu ascenso."
      onBack={onBack}
      onReplay={onReplay}
    />
  );
}
