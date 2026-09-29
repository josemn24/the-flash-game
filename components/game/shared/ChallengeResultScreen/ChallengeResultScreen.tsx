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
  expired = false,
  returnTo,
  returnLabel = "Volver",
}: ChallengeResultScreenProps) {
  const displayModel = expired
    ? {
        ...model,
        statusLabel: "No completado",
        eyebrow: "Partida cerrada",
        title: "Partida cerrada por inactividad",
        subtitle:
          "El desafío terminó mientras la partida estaba inactiva. No se han concedido puntos.",
        score: 0,
        accuracy: 0,
        totalTime: 0,
        metrics: [{ label: "Estado", value: "Abandonada", tone: "danger" as const }],
      }
    : model;
  const maxScore =
    Number.isFinite(displayModel.maxScore) && displayModel.maxScore > 0
      ? displayModel.maxScore
      : 100;
  const score = normalizeResultScore(displayModel.score, maxScore);
  const accuracy = Number.isFinite(displayModel.accuracy)
    ? Math.min(100, Math.max(0, Math.round(displayModel.accuracy)))
    : 0;
  const progress = getResultProgress(score, maxScore);

  return (
    <div className={styles.stage}>
      <GameHeader
        title={displayModel.gameTitle}
        action={<Chip tone={expired ? "danger" : "success"}>{displayModel.statusLabel}</Chip>}
      />
      <div className={styles.resultLayout}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card as="section" className={styles.resultCard} aria-labelledby="challenge-result-title">
            <p className={styles.eyebrow}>{displayModel.eyebrow}</p>
            <h1 id="challenge-result-title">{displayModel.title}</h1>
            {displayModel.subtitle ? (
              <p className={styles.subtitle}>{displayModel.subtitle}</p>
            ) : null}
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
              {returnTo ? (
                <ButtonLink
                  href={returnTo}
                  variant="primary"
                  fullWidth
                  trailingIcon={<ArrowIcon />}
                >
                  {returnLabel}
                </ButtonLink>
              ) : null}
              {onReview ? (
                <Button variant="secondary" fullWidth onClick={onReview} leadingIcon={<EyeIcon />}>
                  Ver respuestas
                </Button>
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
              <strong>{formatResultTime(displayModel.totalTime)}</strong>
            </Card>
          </div>

          <div className={styles.answerStats} data-count={displayModel.metrics.length}>
            {displayModel.metrics.map((metric) => (
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
