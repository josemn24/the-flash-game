"use client";

import { motion } from "motion/react";
import { Button, Card, Chip, GameHeader, Timer } from "@/components/ui";
import {
  ChallengeIntro,
  ChallengeResultScreen,
  ReviewAnswerPanel,
  StartCountdown,
} from "@/components/game/shared";
import { CompetitiveLifecycleNotice } from "@/components/game/shared/CompetitiveLifecycleNotice";
import { ServerQueensQuestion } from "@/components/questions/formats/queens/ServerQueensQuestion";
import { useCompetitiveSession } from "@/features/game/competitive/core/useCompetitiveSession";
import { TIME_TRIAL_END_LABELS } from "@/lib/timeTrial";
import type {
  ServerTimeTrialChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models/room";
import { FlashPopGameShell } from "./FlashPopGameShell";
import { Transition } from "./FlashPopCompetitiveHelpers";
import styles from "./FlashPopFlashGame.module.css";

export function ServerFlashPopTimeTrialGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerTimeTrialChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useCompetitiveSession({ challenge, roomContext, terminalReview });
  const solved = session.results.filter((result) => result.status === "correct").length;
  const earned = session.results.reduce((sum, result) => sum + result.points, 0);
  const running =
    session.deadlineAt !== null && session.phase !== "results" && session.phase !== "review";
  const endReason = session.timeTrial?.endReason;
  const lastCorrect = session.timeTrial?.lastCorrectElapsedMs;
  const timeLabel = lastCorrect == null ? "Sin aciertos" : `${(lastCorrect / 1000).toFixed(2)} s`;

  return (
    <FlashPopGameShell
      layout={session.phase === "intro" ? "intro" : "game"}
      notice={
        <>
          <CompetitiveLifecycleNotice
            error={session.lifecycleError}
            busy={session.busy}
            onRetry={session.retryLifecycle}
          />
          {running ? (
            <GameHeader
              title="Contrarreloj"
              left={
                <p>
                  Prueba {Math.min(session.questionIndex + 1, challenge.slots.length)} de{" "}
                  {challenge.slots.length}
                </p>
              }
              right={
                <>
                  <Timer
                    duration={challenge.timeLimitMs / 1000}
                    active
                    deadlineAt={session.deadlineAt!}
                    onTimeUp={session.onTimeUp}
                    resetKey={challenge.id}
                    size="compact"
                  />
                  <Chip tone="social">
                    {solved} resueltas · {earned} FP
                  </Chip>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={session.busy || session.phase === "finalizing"}
                    onClick={() => void session.abandon()}
                  >
                    Abandonar
                  </Button>
                </>
              }
            />
          ) : null}
        </>
      }
    >
      <motion.div
        key={session.phase}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {session.phase === "intro" ? (
          <ChallengeIntro
            key="intro"
            introduction={{
              title: challenge.title,
              mode: "time-trial",
              questionCount: challenge.slots.length,
              maxScore: 100,
              timeLimitMs: challenge.timeLimitMs,
            }}
            onStart={session.begin}
            canStart
            notice={session.startNotice}
            returnTo={roomContext.returnTo}
            transfer={
              session.transfer
                ? {
                    busy: session.busy,
                    onConfirm: session.takeOver,
                    onCancel: session.cancelTakeOver,
                  }
                : undefined
            }
          />
        ) : null}
        {session.phase === "countdown" ? (
          <StartCountdown
            key="countdown"
            label="Contrarreloj"
            onComplete={session.startQuestions}
          />
        ) : null}
        {(session.phase === "playing" || session.phase === "checking") &&
        session.question?.type === "queens" ? (
          <Card key={session.question.id} className={styles.stageFrame}>
            <h1>{session.question.question}</h1>
            <ServerQueensQuestion
              question={session.question}
              progress={session.question.progress}
              locked={session.locked}
              validationState={session.queensState}
              validationStatusVisible={session.queensStatusVisible}
              validationError={session.queensError}
              onDraft={session.updateQueensDraft}
              onValidate={session.validateQueensBoard}
              onRetry={session.retryQueensValidation}
            />
          </Card>
        ) : null}
        {session.phase === "transition" ? (
          <Transition
            key="transition"
            result={session.lastResult}
            timedOut={false}
            isLast={false}
          />
        ) : null}
        {["recovering", "preparing", "finalizing"].includes(session.phase) ? (
          <Card key={session.phase} role="status" aria-live="polite">
            <h1>
              {session.phase === "recovering"
                ? "Recuperando partida"
                : session.phase === "finalizing"
                  ? "Finalizando partida…"
                  : "Preparando prueba…"}
            </h1>
            <p>
              {session.phase === "finalizing"
                ? "Estamos confirmando y guardando tu resultado."
                : "Comprobamos el estado de tu intento."}
            </p>
          </Card>
        ) : null}
        {session.phase === "results" ? (
          <ChallengeResultScreen
            key="results"
            model={{
              gameTitle: "Contrarreloj",
              statusLabel: "Completado",
              eyebrow: "Desafío completado",
              title:
                solved === challenge.slots.length
                  ? "Todas las pruebas resueltas"
                  : "Tu recorrido contrarreloj",
              subtitle: endReason
                ? TIME_TRIAL_END_LABELS[endReason]
                : session.terminalReason === "permission_revoked"
                  ? "Permiso competitivo retirado"
                  : undefined,
              score: session.score,
              maxScore: 100,
              scoreUnit: "flashPoints",
              accuracy: (solved / challenge.slots.length) * 100,
              totalTime: session.timeTrial?.elapsedTimeMs
                ? session.timeTrial.elapsedTimeMs / 1000
                : 0,
              metrics: [
                {
                  label: "Pruebas resueltas",
                  value: `${solved}/${challenge.slots.length}`,
                  tone: "success",
                },
                { label: "Hasta el último acierto", value: timeLabel },
              ],
            }}
            returnTo={roomContext.returnTo}
            expired={session.attemptExpired}
            onReview={session.reviewChallenge ? session.showReview : undefined}
          />
        ) : null}
        {session.phase === "review" && session.reviewChallenge?.mode === "flash" ? (
          <ReviewAnswerPanel
            key="review"
            title="Historial de pruebas"
            countLabel={`${solved} de ${challenge.slots.length} resueltas`}
            progress={{ value: solved, max: challenge.slots.length }}
            onBack={session.showResults}
            entries={challenge.slots.map((slot, index) => {
              const result = session.results.find((item) => item.questionId === slot.id);
              return {
                id: slot.id,
                marker: String(index + 1).padStart(2, "0"),
                title: `Prueba ${index + 1}`,
                question:
                  session.reviewChallenge?.mode === "flash"
                    ? session.reviewChallenge.questions.find((question) => question.id === slot.id)
                    : undefined,
                result,
                status: result?.status ?? "locked",
                statusLabel: result
                  ? result.status === "correct"
                    ? "Resuelta"
                    : "Sin resolver"
                  : "No alcanzada",
                lockedMessage: "No alcanzada: el desafío terminó antes de entregar esta prueba.",
              };
            })}
          />
        ) : null}
      </motion.div>
    </FlashPopGameShell>
  );
}
