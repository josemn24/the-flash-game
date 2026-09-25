"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowIcon, Button, ButtonLink, Chip, GameHeader } from "@/components/ui";
import {
  buildChallengeIntroModel,
  buildSafeChallengeIntroModel,
  type SafeChallengeIntroduction,
} from "@/lib/challengeIntro";
import type { Challenge } from "@/types/game";
import styles from "./ChallengeIntro.module.css";

type FullChallengeIntroProps = {
  challenge: Challenge;
  introduction?: never;
  onStart: () => void;
  note?: ReactNode;
  notice?: string;
  returnTo?: string;
  canStart?: boolean;
  startHref?: string;
};

type SafeChallengeIntroProps = {
  challenge?: never;
  introduction: SafeChallengeIntroduction;
  /** Server-backed games may start without ever serializing their question payloads. */
  onStart?: () => void;
  note?: ReactNode;
  notice?: string;
  returnTo?: string;
  canStart: boolean;
  startHref?: string;
};

export function ChallengeIntro({
  challenge,
  introduction,
  onStart,
  note,
  notice,
  returnTo = "/",
  canStart = true,
  startHref,
}: FullChallengeIntroProps | SafeChallengeIntroProps) {
  const model = challenge
    ? buildChallengeIntroModel(challenge)
    : buildSafeChallengeIntroModel(introduction);

  return (
    <motion.section
      className={styles.screen}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <GameHeader
        left={
          <Link className={styles.backButton} href={returnTo} aria-label="Volver a desafíos">
            <ArrowIcon className={styles.backIcon} />
          </Link>
        }
      />

      <div className={styles.content}>
        <section className={styles.stageCard} aria-labelledby="challenge-intro-title">
          <div className={styles.cardContent}>
            <Chip tone="social">{model.contextLabel}</Chip>
            <h1 id="challenge-intro-title">{model.title}</h1>

            <div className={styles.metrics} aria-label="Resumen del desafío">
              {model.metrics.map((metric) => (
                <div className={styles.metric} key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>

            <ul className={styles.rules} aria-label="Reglas principales">
              {model.rules.map((rule, index) => (
                <li key={rule.title}>
                  <span className={styles.ruleIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{rule.title}</strong> {rule.description}
                  </span>
                </li>
              ))}
            </ul>

            {notice ? (
              <p className={styles.notice} role="alert">
                {notice}
              </p>
            ) : null}

            {challenge || canStart ? (
              startHref ? (
                <ButtonLink href={startHref} size="hero" fullWidth trailingIcon={<ArrowIcon />}>
                  Empezar desafío
                </ButtonLink>
              ) : (
                <Button
                  size="hero"
                  fullWidth
                  onClick={onStart}
                  disabled={!(challenge || introduction)}
                  trailingIcon={<ArrowIcon />}
                >
                  Empezar desafío
                </Button>
              )
            ) : null}
            {note ? <p className={styles.note}>{note}</p> : null}
          </div>
        </section>
      </div>
    </motion.section>
  );
}
