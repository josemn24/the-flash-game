"use client";

import { CheckIcon, ClockIcon, CrossIcon, LockIcon } from "@/components/ui";
import { Button, Card, Chip } from "@/components/ui";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import {
  isPyramidLevelPassed,
  type PyramidAttemptSummary,
} from "@/features/pyramid/pyramidAttempt";
import type { AnswerResult, PyramidChallenge } from "@/types/game";
import styles from "./FlashPopReview.module.css";

function resultLabel(result: AnswerResult | undefined) {
  if (!result) return "No alcanzado";
  if (result.status === "unanswered") return "Tiempo agotado";
  if (isPyramidLevelPassed(result)) return "Superado";
  return result.status === "partial" ? "Parcial" : "Fallado";
}

function resultIcon(result: AnswerResult | undefined) {
  if (!result) return <LockIcon aria-hidden="true" />;
  if (result.status === "unanswered") return <ClockIcon aria-hidden="true" />;
  return isPyramidLevelPassed(result) ? (
    <CheckIcon aria-hidden="true" />
  ) : (
    <CrossIcon aria-hidden="true" />
  );
}

export function FlashPopReview({
  challenge,
  results,
  summary,
  onBack,
  onReplay,
}: {
  challenge: PyramidChallenge;
  results: AnswerResult[];
  summary: PyramidAttemptSummary;
  onBack: () => void;
  onReplay: () => void;
}) {
  return (
    <Card as="section" className={styles.card} aria-labelledby="flash-pop-review-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Revisión</p>
          <h1 id="flash-pop-review-title">Tu ascenso</h1>
        </div>
        <Chip tone={summary.outcome === "summit" ? "success" : "danger"}>
          {summary.levelsCleared}/{challenge.levels.length}
        </Chip>
      </div>

      <div className={styles.levels}>
        {challenge.levels.map((level, index) => {
          const result = results[index];
          const reached = Boolean(result);
          return (
            <details
              className={`${styles.level} ${reached ? styles.reached : styles.locked}`}
              key={level.id}
              open={reached && index === results.length - 1}
            >
              <summary>
                <span className={styles.levelNumber}>{index + 1}</span>
                <span className={styles.levelTitle}>
                  <strong>{level.label}</strong>
                  <small>{level.briefing.title}</small>
                </span>
                <span className={styles.levelStatus}>
                  {resultIcon(result)}
                  <span>{resultLabel(result)}</span>
                </span>
              </summary>
              {result ? (
                <div className={styles.levelBody}>
                  <QuestionReviewContent question={level.question} result={result} />
                  <div className={styles.meta}>
                    <span>{result.timeUsed.toFixed(1)} s</span>
                    <strong>
                      {result.points > 0 ? "+" : ""}
                      {result.points} pts
                    </strong>
                  </div>
                  <p>{level.question.explanation}</p>
                </div>
              ) : (
                <div className={styles.lockedBody}>
                  <LockIcon aria-hidden="true" />
                  <span>No alcanzado: el ascenso terminó en un nivel anterior.</span>
                </div>
              )}
            </details>
          );
        })}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={onBack}>
          Volver al resultado
        </Button>
        <Button variant="secondary" fullWidth onClick={onReplay}>
          Jugar de nuevo
        </Button>
      </div>
    </Card>
  );
}
