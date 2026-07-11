"use client";

import { motion } from "motion/react";
import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  EyeIcon,
  RotateIcon,
} from "@/components/icons";
import { Logo } from "@/components/Logo";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/components/ResultScreen.module.css";
import type { AnswerResult, Stage } from "@/types/game";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}

export function ResultScreen({
  stage,
  results,
  score,
  onReview,
  onReplay,
}: {
  stage: Stage;
  results: AnswerResult[];
  score: number;
  onReview: () => void;
  onReplay: () => void;
}) {
  const correct = results.filter((result) => result.status === "correct").length;
  const incorrect = results.filter((result) => result.status === "incorrect").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const accuracy = Math.round((correct / stage.questions.length) * 100);
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const maxScore = stage.questions.reduce((total, question) => total + question.points, 0);
  const message =
    accuracy >= 80
      ? "Sprint brutal."
      : accuracy >= 50
        ? "Buen ritmo, pero puedes apretar más."
        : "Etapa dura. Vuelve a intentarlo.";

  return (
    <motion.section
      className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-7"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AppHeader className="mb-7" left={<Logo />} right={<Badge>Meta cruzada</Badge>} />

      <div className={styles.resultsGrid}>
        <motion.div
          className={styles.scorePanel}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={`${styles.eyebrow} text-[var(--electric)]`}>Etapa completada</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
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
            <div className="mb-2 flex justify-between font-mono text-[10px] font-bold tracking-wider text-white/35 uppercase">
              <span>Rendimiento</span>
              <span>
                {score} / {maxScore}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <motion.div
                className="h-full rounded-full bg-[var(--electric)]"
                initial={{ width: 0 }}
                animate={{ width: `${(score / maxScore) * 100}%` }}
                transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <Button onClick={onReplay} whileTap={{ scale: 0.98 }}>
            <RotateIcon className="h-5 w-5" />
            Volver a jugar
          </Button>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={onReview}
            whileTap={{ scale: 0.98 }}
          >
            <EyeIcon className="h-5 w-5" />
            Ver respuestas
            <ArrowIcon className="ml-auto h-5 w-5" />
          </Button>
        </motion.div>

        <motion.div
          className={styles.resultsStats}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
        >
          <div className={styles.accuracyCard}>
            <div>
              <p className={`${styles.eyebrow} text-white/40`}>Precisión</p>
              <p className="mt-2 text-sm text-white/45">
                Has acertado {correct} de {stage.questions.length}
              </p>
            </div>
            <div
              className={styles.accuracyRing}
              style={{ "--accuracy": `${accuracy * 3.6}deg` } as React.CSSProperties}
            >
              <span>{accuracy}%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
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
            <div className={styles.resultStatCard}>
              <ClockIcon className="h-5 w-5" />
              <strong>{unanswered}</strong>
              <span>Sin contestar</span>
            </div>
          </div>

          <div className={styles.timeCard}>
            <div className={`${styles.ruleIcon} bg-white/8 text-white/65`}>
              <ClockIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/35">Tiempo total</p>
              <p className="mt-0.5 text-xl font-black text-white">{formatTime(totalTime)}</p>
            </div>
            <span className="ml-auto font-mono text-xs font-bold text-[var(--electric)]">
              SPRINT 01
            </span>
          </div>

          <div className={styles.tipCard}>
            <span className="font-mono text-[10px] font-black tracking-widest text-[var(--electric)] uppercase">
              Consejo flash
            </span>
            <p className="mt-2 text-sm leading-6 text-white/55">
              La velocidad suma, pero solo después de acertar. Lee una vez y confía en tu primera
              intuición.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
