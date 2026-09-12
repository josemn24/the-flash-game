"use client";

import { CheckIcon, CrossIcon, HeartIcon } from "@/components/ui";
import { ChallengeResultScreen } from "@/components/game/shared";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import type { FlashPopSurvivalResult } from "@/features/flash-pop/survivalSocial";
import type { AnswerResult, SurvivalChallenge } from "@/types/game";

export function FlashPopSurvivalResult({
  challenge,
  result,
  results,
  totalTime,
  eliminated,
  onReview,
  returnTo,
}: {
  challenge: SurvivalChallenge;
  result: FlashPopSurvivalResult;
  results: AnswerResult[];
  totalTime: number;
  eliminated: boolean;
  onReview: () => void;
  returnTo: string;
}) {
  const mistakes = results.filter(
    (item) => item.status === "incorrect" || item.status === "unanswered",
  ).length;
  const survived = !eliminated && result.questionsReached >= challenge.questions.length;
  const accuracy = calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit));

  return (
    <ChallengeResultScreen
      model={{
        gameTitle: "Supervivencia",
        statusLabel: survived ? "Completado" : "Partida terminada",
        eyebrow: "Supervivencia: España",
        title: survived ? "Has sobrevivido" : eliminated ? "Sin vidas" : "Buen intento",
        subtitle: survived
          ? `Has completado los ${challenge.questions.length} retos.`
          : `Has llegado al reto ${result.questionsReached} de ${challenge.questions.length}.`,
        score: result.score,
        maxScore: CHALLENGE_MAX_SCORE,
        accuracy,
        totalTime,
        metrics: [
          {
            icon: <CheckIcon />,
            label: "Retos alcanzados",
            value: `${result.questionsReached} / ${challenge.questions.length}`,
            tone: "success",
          },
          {
            icon: <CrossIcon />,
            label: "Vidas consumidas",
            value: mistakes,
            tone: "danger",
          },
          {
            icon: <HeartIcon />,
            label: "Vidas restantes",
            value: result.livesRemaining,
            tone: "social",
          },
        ],
      }}
      onReview={onReview}
      returnTo={returnTo}
      returnLabel="Volver"
    />
  );
}
