import { ProductSignal } from "@/components/product/Measurement.client";
import { CheckIcon, ClockIcon, CrossIcon, LockIcon } from "@/components/ui";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import { getQuestionReviewCardContent } from "@/lib/gameplay/questionReviewCardContent";
import { logicCodeReviewResult } from "@/lib/question-formats/logic-code/review";
import type { AnswerResult, AnswerStatus } from "@/types/gameplay";
import type { PracticeChallenge, PracticeQuestion } from "@/types/gameplay/practice";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import styles from "./ReviewAnswers.module.css";

export type ReviewAnswerVisualStatus = AnswerStatus | "locked";

export type ReviewAnswerEntry = {
  id: string;
  question?: PracticeQuestion;
  result?: AnswerResult;
  marker: string;
  title?: string;
  subtitle?: string;
  showFullTitleOnExpand?: boolean;
  status?: ReviewAnswerVisualStatus;
  statusLabel?: string;
  lockedMessage?: string;
  showMeta?: boolean;
};

function statusFor(entry: ReviewAnswerEntry): ReviewAnswerVisualStatus {
  if (entry.status === "locked") return entry.status;
  if (entry.result?.reviewState && entry.result.status !== "correct") return "partial";
  if (entry.status) return entry.status;
  return entry.result?.status ?? "unanswered";
}

function statusLabel(status: ReviewAnswerVisualStatus, customLabel?: string) {
  if (customLabel) return customLabel;
  if (status === "correct") return "Correcta";
  if (status === "partial") return "Parcial";
  if (status === "incorrect") return "Incorrecta";
  if (status === "locked") return "No alcanzado";
  return "Sin responder";
}

function statusIcon(status: ReviewAnswerVisualStatus) {
  if (status === "correct" || status === "partial") {
    return <CheckIcon aria-hidden="true" />;
  }
  if (status === "incorrect") return <CrossIcon aria-hidden="true" />;
  if (status === "locked") return <LockIcon aria-hidden="true" />;
  return <ClockIcon aria-hidden="true" />;
}

function resultSummary(result: AnswerResult, question: PracticeQuestion) {
  const details = result.details;
  const summary: string[] = [];

  if (details?.type === "matching") {
    summary.push(`${details.correctPairs}/${details.totalPairs} parejas correctas`);
  }
  if (details?.type === "connect-pairs") {
    summary.push(`${details.connectedPairs}/${details.totalPairs} parejas conectadas`);
  }
  if (details?.type === "memory-pairs") {
    summary.push(`${details.matchedPairs}/${details.totalPairs} parejas encontradas`);
  }
  if (details?.type === "flash-memory") {
    summary.push(`${details.correctPlacements}/${details.totalPlacements} posiciones correctas`);
  }
  if (details?.type === "image-labeling" && details.task === "assign-all") {
    summary.push(`${details.correctLabels}/${details.totalLabels} etiquetas correctas`);
  }
  if (question.type === "logic-code") {
    const { attemptCount } = logicCodeReviewResult(result);
    summary.push(`${attemptCount} ${attemptCount === 1 ? "intento" : "intentos"}`);
  }
  if (details?.type === "estimation") {
    summary.push(`Cercanía: ${Math.round(details.proximity * 100)}%`);
  }

  summary.push(`${result.points} puntos`);
  summary.push(`${result.timeUsed.toFixed(1)} s`);
  return summary.join(" · ");
}

export function ReviewAnswerList({
  entries,
  initialOpenId,
}: {
  entries: ReviewAnswerEntry[];
  initialOpenId?: string;
}) {
  return (
    <div className={styles.reviewAnswerList}>
      {entries.length > 0 ? <ProductSignal type="review_viewed" /> : null}
      {entries.map((entry) => {
        const status = statusFor(entry);
        const result = entry.result;
        const hasUnsubmittedConnectPairsDraft =
          status === "partial" &&
          entry.question?.type === "connect-pairs" &&
          result?.answer === null &&
          result.reviewState?.type === "connect-pairs" &&
          !(
            result.status === "partial" &&
            result.details?.type === "connect-pairs" &&
            result.details.timeoutPartialCredit
          );
        const visualStatusLabel = hasUnsubmittedConnectPairsDraft
          ? "Borrador"
          : statusLabel(status, entry.statusLabel);
        const title =
          entry.title ?? (entry.question ? QUESTION_FORMAT_LABELS[entry.question.type] : "Nivel");
        const subtitle = entry.subtitle ?? entry.question?.category ?? "";
        const titleClassName = entry.showFullTitleOnExpand
          ? `${styles.reviewAnswerTitle} ${styles.reviewAnswerTitleExpandable}`
          : styles.reviewAnswerTitle;

        return (
          <details
            className={`${styles.reviewAnswerRow} ${styles[`reviewAnswer_${status}`]}`}
            key={entry.id}
            open={entry.id === initialOpenId}
          >
            <summary>
              <span className={styles.reviewAnswerNumber}>{entry.marker}</span>
              <span className={titleClassName}>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </span>
              <span className={styles.reviewAnswerStatus}>
                {statusIcon(status)}
                <span>{visualStatusLabel}</span>
              </span>
            </summary>

            {status === "locked" ? (
              <div className={styles.reviewAnswerLockedBody}>
                <LockIcon aria-hidden="true" />
                <span>
                  {entry.lockedMessage ?? "Este desafío terminó antes de esta respuesta."}
                </span>
              </div>
            ) : entry.question && (result || entry.showFullTitleOnExpand) ? (
              <div className={styles.reviewAnswerBody}>
                {entry.showFullTitleOnExpand ? (
                  <div className={styles.reviewAnswerExpandedQuestion}>
                    <span>Pregunta</span>
                    <p>{title}</p>
                  </div>
                ) : null}
                {result ? (
                  <QuestionReviewContent question={entry.question} result={result} />
                ) : null}
                {result && entry.showMeta !== false ? (
                  <div className={styles.reviewAnswerMeta} aria-label="Resumen de la respuesta">
                    {resultSummary(result, entry.question)}
                  </div>
                ) : null}
                {result ? (
                  <p className={styles.reviewAnswerExplanation}>{entry.question.explanation}</p>
                ) : null}
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}

function questionsFor(challenge: PracticeChallenge): PracticeQuestion[] {
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

export function reviewQuestionsFor(challenge: PracticeChallenge) {
  return questionsFor(challenge);
}

export function buildReviewAnswerEntries(
  challenge: PracticeChallenge,
  results: AnswerResult[],
): ReviewAnswerEntry[] {
  const resultByQuestionId = new Map(results.map((result) => [result.questionId, result]));

  return questionsFor(challenge).map((question, index) => {
    const result = resultByQuestionId.get(question.id);
    const pyramidLocked = challenge.mode === "pyramid" && !result;

    return {
      id: question.id,
      question,
      result,
      marker: String(index + 1).padStart(2, "0"),
      ...(challenge.mode === "flash" || challenge.mode === "survival"
        ? { ...getQuestionReviewCardContent(question), showFullTitleOnExpand: true }
        : {}),
      status: pyramidLocked ? "locked" : undefined,
      lockedMessage: pyramidLocked
        ? "No alcanzado: el ascenso terminó en un nivel anterior."
        : undefined,
    };
  });
}
