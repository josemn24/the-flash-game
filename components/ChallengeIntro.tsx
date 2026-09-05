"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowIcon, BoltIcon, ClockIcon, HeartIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { GameHeader, Chip, MotionButton } from "@/components/ui";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import styles from "@/components/ChallengeIntro.module.css";
import type { FlashChallenge, SurvivalChallenge } from "@/types/game";

export function ChallengeIntro({
  challenge,
  onStart,
}: {
  challenge: FlashChallenge | SurvivalChallenge;
  onStart: () => void;
}) {
  const formats = Array.from(
    new Set(challenge.questions.map((question) => QUESTION_FORMAT_LABELS[question.type])),
  );
  const isSurvival = challenge.mode === "survival";

  return (
    <motion.section
      className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col px-4 py-5 sm:px-6 sm:py-7"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <GameHeader
        left={
          <Link href="/" aria-label="Volver a los desafíos">
            <Logo />
          </Link>
        }
        right={
          <Link
            className="font-mono text-[10px] font-black tracking-[0.12em] text-[var(--color-ink-muted)] uppercase transition-colors hover:text-[var(--color-ink)]"
            href="/"
          >
            Volver a desafíos
          </Link>
        }
      />

      <div className="flex flex-1 items-center py-8 sm:py-12">
        <div className={`${styles.stageCard} w-full`}>
          <div className={styles.stageCardStripe} />
          <div className="relative z-10 p-5 sm:p-8 md:p-10">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className={`${styles.eyebrow} mb-3 text-[var(--color-brand)]`}>
                  {isSurvival ? "Modo supervivencia" : "Siguiente carrera"}
                </p>
                <h1 className="text-4xl font-black tracking-[-0.05em] text-[var(--color-ink)] sm:text-5xl">
                  {challenge.title}
                </h1>
                <p className="mt-2 text-base font-bold text-[var(--color-ink-muted)]">
                  {challenge.subtitle}
                </p>
              </div>
              <div className={styles.stageNumber}>{String(challenge.number).padStart(2, "0")}</div>
            </div>

            <p className="max-w-xl text-sm leading-6 text-[var(--color-ink-muted)] sm:text-base">
              {challenge.description}
            </p>

            <div className="my-7 grid grid-cols-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] sm:my-8">
              <div className={styles.stageStat}>
                <strong>{challenge.questions.length}</strong>
                <span>Retos</span>
              </div>
              <div className={`${styles.stageStat} border-x border-[var(--color-border)]`}>
                <strong>{CHALLENGE_MAX_SCORE}</strong>
                <span>Puntos</span>
              </div>
              <div className={`${styles.stageStat} border-r border-[var(--color-border)]`}>
                <strong>{isSurvival ? challenge.lives : "≈ 2"}</strong>
                <span>{isSurvival ? "Vidas" : "Minutos"}</span>
              </div>
              <div className={styles.stageStat}>
                <strong>{formats.length}</strong>
                <span>Formatos</span>
              </div>
            </div>

            <div className="mb-7 flex flex-wrap items-center gap-2" aria-label="Formatos incluidos">
              <span className="mr-1 font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--color-ink-faint)] uppercase">
                Incluye
              </span>
              {formats.map((format) => (
                <Chip key={format}>{format}</Chip>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className={styles.ruleCard}>
                <div
                  className={`${styles.ruleIcon} bg-[var(--color-brand)] text-[var(--color-text-on-brand)]`}
                >
                  {isSurvival ? (
                    <HeartIcon className="h-5 w-5" />
                  ) : (
                    <BoltIcon className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--color-ink)]">
                    {isSurvival ? "Tres vidas" : "Primero, acierta"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-ink-muted)]">
                    {isSurvival
                      ? "Cada fallo claro o timeout consume una vida."
                      : "Después, responde rápido para sumar más."}
                  </p>
                </div>
              </div>
              <div className={styles.ruleCard}>
                <div
                  className={`${styles.ruleIcon} bg-[var(--color-surface-soft)] text-[var(--color-ink)]`}
                >
                  <ClockIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--color-ink)]">
                    {isSurvival ? "Llega al reto 20" : "Sin pausas"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-ink-muted)]">
                    {isSurvival
                      ? "Los parciales puntúan y no restan vida."
                      : "Una vez empieces, el temporizador no se detiene."}
                  </p>
                </div>
              </div>
            </div>

            <MotionButton
              className="mt-7 sm:mt-8"
              onClick={onStart}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              Empezar desafío
              <ArrowIcon className="h-5 w-5" />
            </MotionButton>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
