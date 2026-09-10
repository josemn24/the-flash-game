import { CheckIcon, ClockIcon, CrossIcon, LockIcon } from "@/components/ui";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type {
  AnswerResult,
  AnswerStatus,
  Challenge,
  Question,
} from "@/types/game";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import styles from "./ReviewAnswers.module.css";

export type ReviewAnswerVisualStatus = AnswerStatus | "locked";

export type ReviewAnswerEntry = {
  id: string;
  question: Question;
  result?: AnswerResult;
  marker: string;
  title?: string;
  subtitle?: string;
  status?: ReviewAnswerVisualStatus;
  statusLabel?: string;
  lockedMessage?: string;
  showMeta?: boolean;
};

function statusFor(entry: ReviewAnswerEntry): ReviewAnswerVisualStatus {
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

function resultSummary(result: AnswerResult) {
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
  if (details?.type === "logic-code") {
    summary.push(`${details.submittedCodes.length} intentos`);
  }
  if (details?.type === "estimation") {
    summary.push(`Cercanía: ${Math.round(details.proximity * 100)}%`);
  }

  summary.push(`${result.points} puntos`);
  summary.push(`${result.timeUsed.toFixed(1)} s`);
  return summary.join(" · ");
}

function firstOpenId(entries: ReviewAnswerEntry[]) {
  return entries.find((entry) => statusFor(entry) !== "locked")?.id ?? entries[0]?.id;
}

export function ReviewAnswerList({
  entries,
  initialOpenId,
}: {
  entries: ReviewAnswerEntry[];
  initialOpenId?: string;
}) {
  const openId = initialOpenId ?? firstOpenId(entries);

  return (
    <div className={styles.reviewAnswerList}>
      {entries.map((entry) => {
        const status = statusFor(entry);
        const result = entry.result;
        const title = entry.title ?? QUESTION_FORMAT_LABELS[entry.question.type];
        const subtitle = entry.subtitle ?? entry.question.category;

        return (
          <details
            className={`${styles.reviewAnswerRow} ${styles[`reviewAnswer_${status}`]}`}
            key={entry.id}
            open={entry.id === openId}
          >
            <summary>
              <span className={styles.reviewAnswerNumber}>{entry.marker}</span>
              <span className={styles.reviewAnswerTitle}>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </span>
              <span className={styles.reviewAnswerStatus}>
                {statusIcon(status)}
                <span>{statusLabel(status, entry.statusLabel)}</span>
              </span>
            </summary>

            {status === "locked" ? (
              <div className={styles.reviewAnswerLockedBody}>
                <LockIcon aria-hidden="true" />
                <span>{entry.lockedMessage ?? "Este desafío terminó antes de esta respuesta."}</span>
              </div>
            ) : result ? (
              <div className={styles.reviewAnswerBody}>
                <QuestionReviewContent question={entry.question} result={result} />
                {entry.showMeta !== false ? (
                  <div className={styles.reviewAnswerMeta} aria-label="Resumen de la respuesta">
                    {resultSummary(result)}
                  </div>
                ) : null}
                <p className={styles.reviewAnswerExplanation}>{entry.question.explanation}</p>
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}

function questionsFor(challenge: Challenge): Question[] {
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

export function reviewQuestionsFor(challenge: Challenge) {
  return questionsFor(challenge);
}

export function buildReviewAnswerEntries(
  challenge: Challenge,
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
      status: pyramidLocked ? "locked" : undefined,
      lockedMessage: pyramidLocked
        ? "No alcanzado: el ascenso terminó en un nivel anterior."
        : undefined,
    };
  });
}
