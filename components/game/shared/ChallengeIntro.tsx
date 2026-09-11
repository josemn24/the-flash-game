"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Logo } from "@/components/navigation/Logo";
import { ArrowIcon, Button, Chip, GameHeader } from "@/components/ui";
import { buildChallengeIntroModel } from "@/lib/challengeIntro";
import type { Challenge } from "@/types/game";
import styles from "./ChallengeIntro.module.css";

export function ChallengeIntro({
  challenge,
  onStart,
  note,
  notice,
}: {
  challenge: Challenge;
  onStart: () => void;
  note?: ReactNode;
  notice?: string;
}) {
  const model = buildChallengeIntroModel(challenge);

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
          <div className={styles.headerLeft}>
            <Link href="/" aria-label="Volver a los desafíos">
              <Logo compact />
            </Link>
            <span className={styles.headerMode}>{model.modeLabel}</span>
          </div>
        }
        right={
          <Link className={styles.backLink} href="/">
            Volver a desafíos
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

            <Button size="hero" fullWidth onClick={onStart} trailingIcon={<ArrowIcon />}>
              Empezar desafío
            </Button>
            {note ? <p className={styles.note}>{note}</p> : null}
          </div>
        </section>
      </div>
    </motion.section>
  );
}
