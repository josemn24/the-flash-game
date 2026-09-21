"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowIcon, CheckIcon, ClockIcon, CrossIcon, EyeIcon, RotateIcon } from "@/components/ui";
import { Logo } from "@/components/navigation/Logo";
import { GameHeader, Chip, MotionButton } from "@/components/ui";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import styles from "./ResultScreen.module.css";
import type { AnswerResult, FlashChallenge } from "@/types/game";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}

export function ResultScreen({
  challenge,
  results,
  score,
  onReview,
  onReplay,
}: {
  challenge: FlashChallenge;
  results: AnswerResult[];
  score: number;
  onReview: () => void;
  onReplay: () => void;
}) {
  const correct = results.filter((result) => result.status === "correct").length;
  const partial = results.filter((result) => result.status === "partial").length;
  const incorrect = results.filter((result) => result.status === "incorrect").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const accuracyContribution = results.reduce(
    (total, result) =>
      total +
      (result.status === "correct"
        ? 1
        : result.details?.type === "estimation"
          ? result.details.proximity
          : 0),
    0,
  );
  const accuracy = Math.round((accuracyContribution / challenge.questions.length) * 100);
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const maxScore = CHALLENGE_MAX_SCORE;
  const message =
    accuracy >= 80
      ? "Sprint brutal."
      : accuracy >= 50
        ? "Buen ritmo, pero puedes apretar más."
        : "Desafío duro. Vuelve a intentarlo.";

  return (
    <motion.section
      className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-7"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <GameHeader
        className="mb-7"
        left={
          <Link href="/" aria-label="Volver a los desafíos">
            <Logo />
          </Link>
        }
        right={<Chip>Meta cruzada</Chip>}
      />

      <div className={styles.resultsGrid}>
        <motion.div
          className={styles.scorePanel}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={`${styles.eyebrow} text-[var(--color-brand)]`}>Desafío completado</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[var(--color-ink)] sm:text-4xl">
            {message}
          </h1>

          <div className={styles.scoreDisplay}>
            <div className={styles.scoreGlow} />
            <motion.span
              initial={{ scale: 0.65, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 180, damping: 16 }}
            >
              {score}
            </motion.span>
            <small>puntos</small>
          </div>

          <div className="mb-7">
            <div className="mb-2 flex justify-between font-mono text-[10px] font-bold tracking-wider text-[var(--color-ink-faint)] uppercase">
              <span>Rendimiento</span>
              <span>
                {score} / {maxScore}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
              <motion.div
                className="h-full rounded-full bg-[var(--color-brand)]"
                initial={{ width: 0 }}
                animate={{ width: `${(score / maxScore) * 100}%` }}
                transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <MotionButton onClick={onReplay} whileTap={{ scale: 0.98 }}>
            <RotateIcon className="h-5 w-5" />
            Volver a jugar
          </MotionButton>
          <MotionButton
            variant="secondary"
            className="mt-3"
            onClick={onReview}
            whileTap={{ scale: 0.98 }}
          >
            <EyeIcon className="h-5 w-5" />
            Ver respuestas
            <ArrowIcon className="ml-auto h-5 w-5" />
          </MotionButton>
        </motion.div>

        <motion.div
          className={styles.resultsStats}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
        >
          <div className={styles.accuracyCard}>
            <div>
              <p className={`${styles.eyebrow} text-[var(--color-ink-muted)]`}>Precisión</p>
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                {partial > 0
                  ? `${correct} correctas · ${partial} aproximada${partial === 1 ? "" : "s"}`
                  : `Has acertado ${correct} de ${challenge.questions.length}`}
              </p>
            </div>
            <div
              className={styles.accuracyRing}
              style={{ "--accuracy": `${accuracy * 3.6}deg` } as React.CSSProperties}
            >
              <span>{accuracy}%</span>
            </div>
          </div>

          <div className={`grid gap-2.5 ${partial > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
            <div className={`${styles.resultStatCard} ${styles.resultStatCorrect}`}>
              <CheckIcon className="h-5 w-5" />
              <strong>{correct}</strong>
              <span>Correctas</span>
            </div>
            <div className={`${styles.resultStatCard} ${styles.resultStatWrong}`}>
              <CrossIcon className="h-5 w-5" />
              <strong>{incorrect}</strong>
              <span>Falladas</span>
            </div>
            {partial > 0 && (
              <div className={`${styles.resultStatCard} ${styles.resultStatPartial}`}>
                <span className={styles.approximationMark}>≈</span>
                <strong>{partial}</strong>
                <span>Aproximadas</span>
              </div>
            )}
            <div className={styles.resultStatCard}>
              <ClockIcon className="h-5 w-5" />
              <strong>{unanswered}</strong>
              <span>Sin contestar</span>
            </div>
          </div>

          <div className={styles.timeCard}>
            <div
              className={`${styles.ruleIcon} bg-[var(--color-surface-soft)] text-[var(--color-ink-muted)]`}
            >
              <ClockIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-ink-faint)]">Tiempo total</p>
              <p className="mt-0.5 text-xl font-black text-[var(--color-ink)]">
                {formatTime(totalTime)}
              </p>
            </div>
            <span className="ml-auto font-mono text-xs font-bold text-[var(--color-brand)]">
              SPRINT 01
            </span>
          </div>

          <div className={styles.tipCard}>
            <span className="font-mono text-[10px] font-black tracking-widest text-[var(--color-brand)] uppercase">
              Consejo flash
            </span>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              La velocidad suma, pero solo después de acertar. Lee una vez y confía en tu primera
              intuición.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
