"use client";

import { CheckIcon, CrossIcon, HeartIcon } from "@/components/ui";
import { ChallengeResultScreen, ResultCallout, ResultRanking } from "@/components/game/shared";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import type { FlashPopSurvivalResult } from "@/features/flash-pop/survivalSocial";
import type { AnswerResult, GameRoomContext, SurvivalChallenge } from "@/types/game";

export function FlashPopSurvivalResult({
  challenge,
  result,
  results,
  totalTime,
  eliminated,
  onReview,
  onReplay,
  returnTo,
  roomContext,
}: {
  challenge: SurvivalChallenge;
  result: FlashPopSurvivalResult;
  results: AnswerResult[];
  totalTime: number;
  eliminated: boolean;
  onReview: () => void;
  onReplay: () => void;
  returnTo: string;
  roomContext?: GameRoomContext;
}) {
  const correct = results.filter((item) => item.status === "correct").length;
  const partial = results.filter((item) => item.status === "partial").length;
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
        supplementalContent: (
          <>
            <ResultCallout>
              +{result.seasonXpEarned} ⚡ · {result.seasonXpCurrent} / {result.nextLevelAt} ⚡
            </ResultCallout>
            <ResultCallout>
              {correct} aciertos · {partial} parciales · {mistakes} vidas consumidas
            </ResultCallout>
            {roomContext ? (
              <ResultCallout>
                Tu resultado se ha guardado en {roomContext.roomTitle}. Consulta la clasificación al
                volver.
              </ResultCallout>
            ) : (
              <ResultRanking
                meta="Demo"
                rows={result.peers.map((row) => ({
                  id: row.player.id,
                  rank: row.rank,
                  name: row.player.id === "javi" ? "Tú" : row.player.displayName,
                  initials: row.player.initials,
                  tone: row.player.tone,
                  score: `${row.score} pts`,
                  current: row.player.id === "javi",
                }))}
              />
            )}
          </>
        ),
      }}
      onReview={onReview}
      onReplay={onReplay}
      returnTo={returnTo}
      returnLabel={roomContext ? "Volver a Tabarnia" : "Volver al lobby"}
    />
  );
}
