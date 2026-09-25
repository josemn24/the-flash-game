"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ClockIcon, CrossIcon } from "@/components/ui";
import { calculateResultAccuracy, getAnswerResultAccuracyUnit } from "@/features/game/resultSummary";
import type { AnswerResult, Challenge, RoomChallengeResult } from "@/types/game";
import {
  ChallengeResultScreen,
  type ChallengeResultModel,
} from "./ChallengeResultScreen/ChallengeResultScreen";
import { ReviewAnswers } from "./ReviewAnswers";

function toAnswerResult(answer: NonNullable<RoomChallengeResult["attempt"]>["answers"][number]) {
  return {
    questionId: answer.questionId,
    answer: answer.answer,
    status: answer.status,
    isCorrect: answer.isCorrect,
    points: answer.points ?? 0,
    timeUsed: answer.timeUsed ?? 0,
    details: answer.details,
  } satisfies AnswerResult;
}

export function CompetitiveResultScreen({
  challenge,
  result,
  returnTo,
}: {
  challenge: Challenge;
  result: RoomChallengeResult;
  returnTo: string;
}) {
  const [showReview, setShowReview] = useState(false);
  const results = useMemo(
    () => result.attempt?.answers.map(toAnswerResult) ?? [],
    [result.attempt?.answers],
  );
  const model = useMemo<ChallengeResultModel>(() => {
    const correct = results.filter(({ status }) => status === "correct").length;
    const partial = results.filter(({ status }) => status === "partial").length;
    const incorrect = results.filter(({ status }) => status === "incorrect").length;
    const unanswered = results.filter(({ status }) => status === "unanswered").length;
    const accuracy = calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit));
    const title = accuracy >= 80 ? "Sprint brutal." : accuracy >= 50 ? "Buen ritmo." : "Desafío superado.";

    return {
      gameTitle: challenge.title,
      statusLabel: "Completado",
      eyebrow: "Desafío completado",
      title,
      subtitle: challenge.subtitle,
      score: result.flashPoints,
      maxScore: 100,
      scoreUnit: "flashPoints",
      accuracy,
      totalTime: results.reduce((total, answer) => total + answer.timeUsed, 0),
      metrics: [
        { label: "Correctas", value: correct, icon: <CheckIcon />, tone: "success" },
        ...(partial > 0
          ? [{ label: "Aproximadas", value: partial, icon: <span>≈</span>, tone: "social" as const }]
          : []),
        { label: "Falladas", value: incorrect, icon: <CrossIcon />, tone: "danger" },
        { label: "Sin contestar", value: unanswered, icon: <ClockIcon /> },
      ],
    };
  }, [challenge.subtitle, challenge.title, result.flashPoints, results]);

  if (showReview) {
    return (
      <ReviewAnswers
        challenge={challenge}
        results={results}
        onBack={() => setShowReview(false)}
      />
    );
  }

  return (
    <ChallengeResultScreen
      model={model}
      onReview={() => setShowReview(true)}
      returnTo={returnTo}
      returnLabel="Volver a la sala"
    />
  );
}
