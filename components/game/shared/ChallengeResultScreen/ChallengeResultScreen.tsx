"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";
import {
  ArrowIcon,
  Button,
  ButtonLink,
  Card,
  Chip,
  ClockIcon,
  EyeIcon,
  GameHeader,
  RotateIcon,
} from "@/components/ui";
import {
  formatResultTime,
  getResultProgress,
  normalizeResultScore,
} from "@/features/game/resultSummary";
import type { ChallengeResultScreenProps, ResultMetricTone } from "./resultTypes";
import styles from "./ChallengeResultScreen.module.css";

function toneClass(tone: ResultMetricTone | undefined) {
  if (tone === "success") return styles.metricSuccess;
  if (tone === "danger") return styles.metricDanger;
  if (tone === "social") return styles.metricSocial;
  return "";
}

export function ChallengeResultScreen({
  model,
  onReview,
  onReplay,
  returnTo,
  returnLabel = "Volver al lobby",
}: ChallengeResultScreenProps) {
  const maxScore = Number.isFinite(model.maxScore) && model.maxScore > 0 ? model.maxScore : 100;
  const score = normalizeResultScore(model.score, maxScore);
  const accuracy = Number.isFinite(model.accuracy)
    ? Math.min(100, Math.max(0, Math.round(model.accuracy)))
    : 0;
  const progress = getResultProgress(score, maxScore);

  return (
    <div className={styles.stage}>
      <GameHeader
        title={model.gameTitle}
        action={<Chip tone="success">{model.statusLabel}</Chip>}
      />
      <div className={styles.resultLayout}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card as="section" className={styles.resultCard} aria-labelledby="challenge-result-title">
            <p className={styles.eyebrow}>{model.eyebrow}</p>
            <h1 id="challenge-result-title">{model.title}</h1>
            {model.subtitle ? <p className={styles.subtitle}>{model.subtitle}</p> : null}
            <div className={styles.scoreDisplay}>
              <strong>{score}</strong>
              <span>/{maxScore} puntos</span>
            </div>
            <div className={styles.scoreTrack} aria-label={`${score} de ${maxScore} puntos`}>
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className={styles.resultActions}>
              <Button fullWidth onClick={onReplay} leadingIcon={<RotateIcon />}>
                Volver a jugar
              </Button>
              <Button variant="secondary" fullWidth onClick={onReview} leadingIcon={<EyeIcon />}>
                Ver respuestas
              </Button>
              {returnTo ? (
                <ButtonLink
                  href={returnTo}
                  variant="secondary"
                  fullWidth
                  trailingIcon={<ArrowIcon />}
                >
                  {returnLabel}
                </ButtonLink>
              ) : null}
            </div>
          </Card>
        </motion.div>

        <motion.div
          className={styles.resultStats}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
        >
          <div className={styles.summaryStats}>
            <Card className={styles.accuracyCard} aria-label={`Precisión ${accuracy}%`}>
              <div>
                <p className={styles.eyebrow}>Precisión</p>
                <strong>{accuracy}%</strong>
              </div>
              <div
                className={styles.accuracyRing}
                style={{ "--accuracy": `${accuracy * 3.6}deg` } as CSSProperties}
                aria-hidden="true"
              />
            </Card>
            <Card className={styles.timeCard}>
              <div className={styles.timeHeader}>
                <span>Tiempo total</span>
                <ClockIcon />
              </div>
              <strong>{formatResultTime(model.totalTime)}</strong>
            </Card>
          </div>

          <div className={styles.answerStats} data-count={model.metrics.length}>
            {model.metrics.map((metric) => (
              <Card className={`${styles.metricCard} ${toneClass(metric.tone)}`} key={metric.label}>
                <div className={styles.metricHeader}>
                  <span>{metric.label}</span>
                  {metric.icon}
                </div>
                <strong>{metric.value}</strong>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export type { ChallengeResultModel, ChallengeResultScreenProps, ResultMetric } from "./resultTypes";
