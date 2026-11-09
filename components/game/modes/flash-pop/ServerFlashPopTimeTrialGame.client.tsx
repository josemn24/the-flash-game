"use client";

import { useMeasurementAttempt } from "@/components/product/Measurement.client";
import { motion } from "motion/react";
import { Card, GameHeader, Timer } from "@/components/ui";
import {
  ChallengeIntro,
  ChallengeResultScreen,
  ReviewAnswerPanel,
  ServerFlashQuestionStage,
  StartCountdown,
} from "@/components/game/shared";
import { CompetitiveLifecycleNotice } from "@/components/game/shared/CompetitiveLifecycleNotice";
import { useServerTimeTrialSession } from "@/features/game/useServerTimeTrialSession";
import type { useTimeTrialGameSession } from "@/features/game/useServerTimeTrialSession";
import { timeTrialFormat, TIME_TRIAL_END_LABELS } from "@/lib/timeTrial";
import type {
  ServerTimeTrialChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models/room";
import { FlashPopGameShell } from "./FlashPopGameShell";
import { Transition } from "./FlashPopCompetitiveHelpers";
import styles from "./ServerFlashPopTimeTrialGame.module.css";

export function ServerFlashPopTimeTrialGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerTimeTrialChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useServerTimeTrialSession({ challenge, roomContext, terminalReview });
  useMeasurementAttempt(session.attempt?.id);
  return (
    <FlashPopTimeTrialGameView
      challenge={challenge}
      returnTo={roomContext.returnTo}
      session={session}
    />
  );
}

type TimeTrialGameSession = ReturnType<typeof useTimeTrialGameSession>;

/** Shared presentation for competitive and local Time Trial session providers. */
export function FlashPopTimeTrialGameView({
  challenge,
  returnTo,
  session,
  onReplay,
}: {
  challenge: ServerTimeTrialChallenge;
  returnTo: string;
  session: TimeTrialGameSession;
  onReplay?: () => void;
}) {
  const format = timeTrialFormat(challenge.slots.map((slot) => slot.questionType));
  const formatName = format === "queens" ? "Queens" : "Conectar parejas";
  const rules =
    format === "queens"
      ? [
          "1 corona por región de color",
          "1 corona por fila y columna",
          "No pueden tocarse, ni en diagonal",
        ]
      : ["Une los puntos iguales", "Cubre todo el tablero", "No cruces ni compartas casillas"];
  const solved = session.results.filter((result) => result.status === "correct").length;
  const partialPoints = session.results.reduce(
    (total, result) => total + (result.status === "partial" ? result.points : 0),
    0,
  );
  const provisionalSolved = Math.max(solved, session.timeTrial?.solvedCount ?? 0);
  const provisionalScore =
    session.timeTrial?.points ??
    session.results.reduce((total, result) => total + result.points, 0);
  const running =
    session.deadlineAt !== null &&
    session.phase !== "finalizing" &&
    session.phase !== "results" &&
    session.phase !== "review";
  const endReason = session.timeTrial?.endReason;
  const lastCorrect = session.timeTrial?.lastCorrectElapsedMs;
  const timeLabel = lastCorrect == null ? "Sin aciertos" : `${(lastCorrect / 1000).toFixed(2)} s`;
  const progressLabel = `Prueba ${Math.min(
    session.questionIndex + 1,
    challenge.slots.length,
  )} de ${challenge.slots.length}`;
  const reviewChallenge =
    session.reviewChallenge?.mode === "flash" ? session.reviewChallenge : null;

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
              left={<p className={styles.progressLabel}>{progressLabel}</p>}
              className={styles.timeTrialHeader}
              actionsClassName={styles.timeTrialActions}
              right={
                <Timer
                  duration={challenge.timeLimitMs / 1000}
                  active
                  deadlineAt={session.deadlineAt!}
                  onTimeUp={session.onTimeUp}
                  resetKey={challenge.id}
                  size="compact"
                />
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
              timeTrialFormat: format,
              timeoutPartialCredit:
                challenge.queensTimeoutPartialCredit || challenge.connectPairsTimeoutPartialCredit,
            }}
            onStart={session.begin}
            canStart
            notice={session.startNotice}
            returnTo={returnTo}
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
        {session.phase === "finalizing" ? (
          <Card key="provisional-result" role="status" aria-live="polite">
            <h1>Resultado provisional</h1>
            <p>Guardando resultado en el servidor…</p>
            <p>
              {provisionalSolved}/{challenge.slots.length} pruebas resueltas · {provisionalScore}{" "}
              puntos
            </p>
          </Card>
        ) : null}
        {["playing", "checking", "finalizing"].includes(session.phase) &&
        session.question &&
        session.questionInput ? (
          <ServerFlashQuestionStage
            input={session.questionInput}
            key={session.question.id}
            titleOverride={formatName}
            promptContent={
              <ul
                className={`${styles.rulesCards} ${format === "connect-pairs" ? styles.connectPairsRules : ""}`}
                aria-label={`Reglas de ${formatName}`}
              >
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            }
            questionNumber={session.questionIndex + 1}
            totalQuestions={challenge.slots.length}
            onTimeUp={session.onTimeUp}
            deadlineAt={session.questionDeadlineAt}
            presentation="time-trial"
            showHeader={false}
            showTimer={false}
          />
        ) : null}
        {session.phase === "transition" ? (
          <Transition
            key="transition"
            result={session.lastResult}
            timedOut={false}
            isLast={false}
          />
        ) : null}
        {["recovering", "preparing"].includes(session.phase) ? (
          <Card key={session.phase} role="status" aria-live="polite">
            <h1>{session.phase === "recovering" ? "Recuperando partida" : "Preparando prueba…"}</h1>
            <p>
              {session.phase === "recovering"
                ? "Comprobamos el estado de tu intento."
                : "Estamos preparando la siguiente prueba."}
            </p>
          </Card>
        ) : null}
        {session.phase === "results" ? (
          <ChallengeResultScreen
            key="results"
            model={{
              gameTitle: "Contrarreloj",
              statusLabel: "Completado",
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
                ...(partialPoints > 0 ? [{ label: "Puntos parciales", value: partialPoints }] : []),
              ],
            }}
            returnTo={returnTo}
            expired={session.attemptExpired}
            onReview={session.reviewChallenge ? session.showReview : undefined}
            onReplay={onReplay}
          />
        ) : null}
        {session.phase === "review" && reviewChallenge ? (
          <ReviewAnswerPanel
            key="review"
            title="Historial de respuestas"
            countLabel={`${solved} de ${challenge.slots.length} resueltas`}
            progress={{ value: solved, max: challenge.slots.length }}
            progressLabel="Pruebas resueltas"
            backAtTop
            onBack={session.showResults}
            entries={challenge.slots.map((slot, index) => {
              const result = session.results.find((item) => item.questionId === slot.id);
              const question = reviewChallenge.questions.find(
                (candidate) => candidate.id === slot.id,
              );
              return {
                id: slot.id,
                marker: String(index + 1).padStart(2, "0"),
                title: `Prueba ${index + 1}`,
                subtitle:
                  question?.type === "queens"
                    ? `Queens · ${question.grid.rows}×${question.grid.columns}`
                    : question?.type === "connect-pairs"
                      ? `Conectar parejas · ${question.grid.rows}×${question.grid.columns}`
                      : "Queens",
                question,
                result,
                status: result?.status ?? "locked",
                statusLabel: !result
                  ? "No alcanzada"
                  : result.status === "correct"
                    ? "Resuelta"
                    : result.status === "unanswered"
                      ? challenge.queensTimeoutPartialCredit &&
                        result.reviewState?.type === "queens"
                        ? "Sin resolver"
                        : "Sin responder"
                      : result.status === "partial"
                        ? "Parcial"
                        : "Sin resolver",
                lockedMessage: "No alcanzada: el desafío terminó antes de entregar esta prueba.",
              };
            })}
          />
        ) : null}
      </motion.div>
    </FlashPopGameShell>
  );
}
