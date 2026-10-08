"use client";

import { CheckIcon, ClockIcon, CrossIcon } from "@/components/ui";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ButtonLink, GameHeader } from "@/components/ui";
import { ReviewAnswerPanel, type ChallengeResultModel } from "@/components/game/shared";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import type { AnswerResult, FlashChallenge } from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";
import styles from "./FlashPopFlashGame.module.css";

export function Transition({
  result,
  timedOut,
  isLast,
}: {
  result?: AnswerResult;
  timedOut: boolean;
  isLast: boolean;
}) {
  const status = result?.status ?? (timedOut ? "unanswered" : "incorrect");
  const { title, body } = getFlashPopFeedbackCopy({ status, timedOut, isLast });

  return (
    <FlashPopFeedback
      status={status}
      title={title}
      body={body}
      points={status === "correct" || status === "partial" ? result?.points : undefined}
    />
  );
}

export function buildResultModel(results: AnswerResult[], score: number): ChallengeResultModel {
  const correct = results.filter((result) => result.status === "correct").length;
  const incorrect = results.filter((result) => result.status === "incorrect").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const accuracy = calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit));
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const message =
    accuracy >= 80 ? "Sprint brutal." : accuracy >= 50 ? "Buen ritmo." : "Desafío duro.";

  return {
    gameTitle: "Flash",
    statusLabel: "Completado",
    eyebrow: "Desafío completado",
    title: message,
    score,
    maxScore: CHALLENGE_MAX_SCORE,
    scoreUnit: "flashPoints",
    accuracy,
    totalTime,
    metrics: [
      { icon: <CheckIcon />, label: "Correctas", value: correct, tone: "success" },
      { icon: <CrossIcon />, label: "Falladas", value: incorrect, tone: "danger" },
      { icon: <ClockIcon />, label: "Sin contestar", value: unanswered },
    ],
  };
}

export function ReviewStage({
  challenge,
  results,
  onBack,
  onReplay,
  returnTo,
  roomContext,
  presentation = "default",
  totalQuestionCount,
}: {
  challenge: FlashChallenge;
  results: AnswerResult[];
  onBack: () => void;
  onReplay?: () => void;
  returnTo: string;
  roomContext?: GameRoomContext;
  presentation?: "default" | "flash" | "survival";
  totalQuestionCount?: number;
}) {
  const resultByQuestionId = new Map(results.map((result) => [result.questionId, result]));
  const entries = challenge.questions.map((question, index) => ({
    id: question.id,
    question,
    result: resultByQuestionId.get(question.id),
    marker: String(index + 1).padStart(2, "0"),
  }));
  const total = totalQuestionCount ?? challenge.questions.length;
  const reached = Math.min(results.length, total);

  if (presentation === "flash" || presentation === "survival") {
    const isFlash = presentation === "flash";
    return (
      <ReviewAnswerPanel
        entries={entries}
        countLabel={
          isFlash
            ? `${reached} ${reached === 1 ? "respuesta" : "respuestas"}`
            : `${reached} de ${total} retos alcanzados`
        }
        title="Historial de respuestas"
        description="Consulta tu respuesta, la solución aceptada y la explicación de cada desafío."
        progress={{ value: reached, max: total }}
        progressLabel={isFlash ? "Respuestas registradas" : "Retos alcanzados"}
        backAtTop
        onBack={onBack}
        onReplay={onReplay}
      />
    );
  }

  return (
    <div className={styles.stage}>
      <GameHeader
        title="Revisión"
        action={
          <ButtonLink href={returnTo} variant="secondary">
            {roomContext ? "Tabarnia" : "Lobby"}
          </ButtonLink>
        }
      />
      <ReviewAnswerPanel
        entries={entries}
        countLabel={`${results.length} respuestas`}
        title="Historial de respuestas"
        description="Consulta tu respuesta, la solución aceptada y la explicación de cada desafío."
        onBack={onBack}
        onReplay={onReplay}
      />
    </div>
  );
}
