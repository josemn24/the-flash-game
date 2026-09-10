"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, Avatar, BoltIcon, Card, Canvas, CheckIcon, Chip, ClockIcon, CrossIcon } from "@/components/ui";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import { useRoomSession } from "@/features/rooms/RoomSessionProvider.client";
import { applyRoomMemberChallengeResult } from "@/lib/roomMemberDetail";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type { AnswerReview, AnswerResult, Challenge, Question, RoomMemberDetailModel } from "@/types/game";
import styles from "./FlashPopRoomMemberDetail.module.css";

function questionsFor(challenge: Challenge | null): Question[] {
  if (!challenge) return [];
  switch (challenge.mode) {
    case "alphabet":
      return challenge.entries.map((entry) => entry.question);
    case "narrative":
      return challenge.beats.flatMap((beat) =>
        beat.steps.flatMap((step) => (step.type === "question" ? [step.question] : [])),
      );
    case "pyramid":
      return challenge.levels.map((level) => level.question);
    default:
      return challenge.questions;
  }
}

function statusLabel(status: AnswerReview["status"]) {
  if (status === "correct") return "Correcta";
  if (status === "partial") return "Parcial";
  if (status === "incorrect") return "Incorrecta";
  return "Sin responder";
}

function statusIcon(status: AnswerReview["status"]) {
  if (status === "correct") return <CheckIcon aria-hidden="true" />;
  if (status === "unanswered") return <ClockIcon aria-hidden="true" />;
  return <CrossIcon aria-hidden="true" />;
}

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

function formatSeconds(value: number) {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function answerSummary(answer: AnswerReview) {
  const summary: string[] = [];
  if (answer.details?.type === "matching") {
    summary.push(`${answer.details.correctPairs}/${answer.details.totalPairs} parejas correctas`);
  }
  summary.push(answer.points === undefined ? "Puntos no desglosados" : `${answer.points} puntos`);
  if (answer.timeUsed !== undefined) summary.push(`${formatSeconds(answer.timeUsed)} s`);
  return summary.join(" · ");
}

function AnswerHistory({ challenge, attempt }: { challenge: Challenge; attempt: NonNullable<RoomMemberDetailModel["result"]>["attempt"] }) {
  if (!attempt) return null;
  const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));

  return (
    <section className={styles.history} aria-labelledby="answer-history-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Desglose completo</p>
          <h2 id="answer-history-title">Historial de respuestas</h2>
        </div>
        <Chip variant="data">{attempt.answers.length} respuestas</Chip>
      </div>
      <div className={styles.answerList}>
        {questionsFor(challenge).map((question, index) => {
          const answer = answers.get(question.id) ?? {
            questionId: question.id,
            answer: null,
            status: "unanswered" as const,
            isCorrect: false,
          };
          const result = toAnswerResult(answer);
          return (
            <details className={styles.answerRow} key={question.id} open={index === 0}>
              <summary>
                <span className={styles.questionNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.questionTitle}>
                  <strong>{QUESTION_FORMAT_LABELS[question.type]}</strong>
                  <small>{question.category}</small>
                </span>
                <span className={`${styles.answerStatus} ${styles[`status_${answer.status}`]}`}>
                  {statusIcon(answer.status)}
                  <span>{statusLabel(answer.status)}</span>
                </span>
              </summary>
              <div className={styles.answerBody}>
                <QuestionReviewContent question={question} result={result} />
                <div className={styles.answerMeta} aria-label="Resumen de la respuesta">
                  {answerSummary(answer)}
                </div>
                <p className={styles.explanation}>{question.explanation}</p>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function FlashPopRoomMemberDetail({ model }: { model: RoomMemberDetailModel }) {
  const { getCompletion } = useRoomSession();
  const completion = model.dailyChallenge
    ? getCompletion(model.roomId, model.dailyChallenge.id)
    : undefined;
  const visibleModel = completion?.attempt
    ? applyRoomMemberChallengeResult(model, {
        roomId: model.roomId,
        challengeId: completion.attempt.challengeId,
        playedAt: completion.attempt.playedAt,
        points: completion.points,
        completed: completion.completed,
        answers: completion.attempt.answers,
      })
    : model;
  const result = visibleModel.result;
  const attempt = result?.attempt;
  const isComplete = Boolean(result?.completed && attempt);

  return (
    <Canvas contentClassName={styles.content}>
      <header className={styles.toolbar}>
        <Link href={`/salas/${model.roomId}/ranking`} className={styles.backLink} aria-label="Volver al ranking de hoy">
          <ArrowIcon className={styles.backIcon} />
        </Link>
        <div className={styles.roomIdentity}>
          <Avatar name={model.roomTitle} initials={model.roomTitle.slice(0, 2).toUpperCase()} tone="social" size="md" />
          <span>{model.roomTitle}</span>
        </div>
      </header>

      <div>
        <section className={styles.profile} aria-labelledby="member-detail-title">
          <Avatar name={visibleModel.member.name} src={visibleModel.member.avatarSrc} initials={visibleModel.member.initials} tone="social" size="lg" />
          <div>
            <p className={styles.eyebrow}>{model.roomTitle}</p>
            <h1 id="member-detail-title">{visibleModel.member.name}</h1>
            <p className={styles.profileMeta}>#{visibleModel.dailyRank ?? "—"} hoy · #{visibleModel.roomRank} en la sala</p>
          </div>
        </section>

        <Card as="section" className={styles.summary} aria-labelledby="attempt-summary-title">
          <div className={styles.summaryHeader}>
            <div>
              <p className={styles.eyebrow}>Reto de hoy</p>
              <h2 id="attempt-summary-title">{visibleModel.dailyChallenge?.title ?? "Sin reto hoy"}</h2>
            </div>
            <Chip tone={isComplete ? "success" : "social"}>{isComplete ? "Completado" : "Pendiente"}</Chip>
          </div>

          {visibleModel.dailyChallenge ? (
            <div className={styles.challengePreview}>
              <Image src={visibleModel.dailyChallenge.imageSrc} alt="" fill sizes="180px" />
            </div>
          ) : null}

          <div className={styles.stats}>
            <div><BoltIcon aria-hidden="true" /><strong>{result?.points ?? 0}</strong><span>Flash points</span></div>
            <div><strong>#{visibleModel.roomRank}</strong><span>ranking de sala</span></div>
            <div><strong>{isComplete ? formatPlayedAt(attempt?.playedAt) : "—"}</strong><span>jugado</span></div>
          </div>

          {!isComplete ? (
            <div className={styles.emptyState}>
              <p>Todavía no ha jugado</p>
              <span>Cuando termine el reto aparecerá aquí el intento completo.</span>
            </div>
          ) : null}
        </Card>

        {isComplete && visibleModel.challenge && attempt ? (
          <AnswerHistory challenge={visibleModel.challenge} attempt={attempt} />
        ) : null}
      </div>
    </Canvas>
  );
}
