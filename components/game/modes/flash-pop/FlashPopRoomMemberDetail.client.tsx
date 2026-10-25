"use client";

import { Avatar, BackLink, BoltIcon, Card, Canvas, Chip } from "@/components/ui";
import { ReviewAnswerList } from "@/components/game/shared";
import { useRoomSession } from "@/features/rooms/RoomSessionProvider.client";
import { applyRoomMemberChallengeResult } from "@/features/rooms/localResults";
import type { AnswerReview, AnswerResult } from "@/types/gameplay";
import type { RoomMemberDetailModel } from "@/types/view-models/room";
import styles from "./FlashPopRoomMemberDetail.module.css";

function toAnswerResult(answer: AnswerReview): AnswerResult {
  return {
    questionId: answer.questionId,
    answer: answer.answer,
    status: answer.status,
    isCorrect: answer.isCorrect,
    points: answer.points ?? 0,
    timeUsed: answer.timeUsed ?? 0,
    details: answer.details,
  };
}

function formatPlayedAt(value?: string) {
  if (!value) return "Sin fecha de intento";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

function formatPlayedAtCompact(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Madrid",
  })
    .format(new Date(value))
    .replace(",", " ·");
}

function AnswerHistory({
  items,
  progress,
}: {
  items: RoomMemberDetailModel["reviewItems"];
  progress: RoomMemberDetailModel["reviewProgress"];
}) {
  if (!items.length) return null;
  const entries = items.map((item, index) => ({
    id: item.id,
    question: item.question ?? undefined,
    result: item.result ? toAnswerResult(item.result) : undefined,
    marker: item.metadata?.alphabetLetter ?? String(index + 1).padStart(2, "0"),
    title: item.title,
    subtitle: item.subtitle,
    showFullTitleOnExpand: progress?.mode === "survival",
    status: item.status,
    statusLabel:
      progress?.mode === "time-trial"
        ? item.status === "locked"
          ? "No alcanzada"
          : item.status === "correct"
            ? "Resuelta"
            : "Sin resolver"
        : undefined,
    lockedMessage:
      item.status === "locked"
        ? progress?.mode === "time-trial"
          ? "No alcanzada: el desafío terminó antes de entregar esta prueba."
          : "No alcanzado: el ascenso terminó en un nivel anterior."
        : undefined,
  }));
  const countLabel =
    progress?.mode === "time-trial"
      ? `${progress.correctCount} de ${progress.totalQuestionCount} pruebas resueltas`
      : progress?.mode === "alphabet"
        ? `${progress.correctCount} de ${progress.totalLetterCount} letras acertadas`
        : progress?.mode === "pyramid"
          ? `${progress.levelsCleared} de ${progress.totalLevelCount} niveles superados`
          : progress?.mode === "survival"
            ? `${progress.reachedQuestionCount} preguntas alcanzadas`
            : `${progress?.answeredCount ?? items.length} respuestas`;

  return (
    <section className={styles.history} aria-labelledby="answer-history-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="answer-history-title">Respuestas</h2>
        </div>
        <Chip variant="data">{countLabel}</Chip>
      </div>
      <ReviewAnswerList entries={entries} />
    </section>
  );
}

export function FlashPopRoomMemberDetail({ model }: { model: RoomMemberDetailModel }) {
  const { getCompletion } = useRoomSession();
  const completion =
    model.source === "supabase" || !model.challengeSummary
      ? undefined
      : getCompletion(model.roomId, model.challengeSummary.id);
  const visibleModel = completion?.attempt
    ? applyRoomMemberChallengeResult(model, {
        roomId: model.roomId,
        challengeId: completion.attempt.challengeId,
        startedAt: completion.attempt.startedAt,
        playedAt: completion.attempt.playedAt,
        flashPoints: completion.flashPoints,
        completed: completion.completed,
        durationMs: completion.attempt.durationMs,
        answers: completion.attempt.answers,
      })
    : undefined;
  const resolvedModel = visibleModel ?? model;
  const result = resolvedModel.result;
  const attempt = result?.attempt;
  const hasAttempt = Boolean(attempt);
  const isComplete = Boolean(result?.completed && attempt);

  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.toolbar}>
        <BackLink href={model.returnHref} label="Volver al origen del resultado" />
      </header>

      <div>
        <section className={styles.profile} aria-labelledby="member-detail-title">
          <Avatar
            name={resolvedModel.member.name}
            src={resolvedModel.member.avatarSrc}
            initials={resolvedModel.member.initials}
            tone="social"
            size="lg"
          />
          <div>
            <p className={styles.eyebrow}>{model.roomTitle}</p>
            <h1 id="member-detail-title">{resolvedModel.member.name}</h1>
          </div>
        </section>

        <Card as="section" className={styles.summary} aria-labelledby="attempt-summary-title">
          <h2 id="attempt-summary-title">
            {resolvedModel.challengeSummary?.title ?? "Sin reto disponible"}
          </h2>

          <div className={styles.stats}>
            <div>
              <div className={styles.statValue}>
                <BoltIcon aria-hidden="true" />
                <strong>{result?.flashPoints ?? 0}</strong>
              </div>
              <span>Puntos del reto</span>
            </div>
            <div>
              <div className={styles.statValue}>
                <strong>#{resolvedModel.challengeRank ?? "—"}</strong>
              </div>
              <span>ranking del reto</span>
            </div>
            <div>
              <div className={styles.statValue}>
                <time
                  dateTime={hasAttempt ? attempt?.playedAt : undefined}
                  aria-label={
                    hasAttempt ? `Jugado el ${formatPlayedAt(attempt?.playedAt)}` : undefined
                  }
                >
                  {hasAttempt ? formatPlayedAtCompact(attempt?.playedAt) : "—"}
                </time>
              </div>
              <span>jugado</span>
            </div>
          </div>

          {!hasAttempt ? (
            <div className={styles.emptyState}>
              <p>Todavía no ha jugado</p>
              <span>Cuando termine el reto aparecerá aquí el intento completo.</span>
            </div>
          ) : !isComplete ? (
            <div className={styles.emptyState}>
              <p>Partida abandonada</p>
              <span>Se muestran las respuestas que llegó a enviar y los huecos sin responder.</span>
            </div>
          ) : null}
        </Card>

        {hasAttempt && resolvedModel.reviewItems.length ? (
          <AnswerHistory
            items={resolvedModel.reviewItems}
            progress={resolvedModel.reviewProgress}
          />
        ) : null}
      </div>
    </Canvas>
  );
}
