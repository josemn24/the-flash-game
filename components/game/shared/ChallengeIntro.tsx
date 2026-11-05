"use client";
import { useProductSignal } from "@/components/product/Measurement.client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowIcon,
  BackButton,
  BackLink,
  Button,
  ButtonLink,
  Chip,
  FlaskIcon,
  GameHeader,
} from "@/components/ui";
import {
  buildChallengeIntroModel,
  buildSafeChallengeIntroModel,
  type SafeChallengeIntroduction,
} from "@/lib/challengeIntro";
import type { PracticeChallenge } from "@/types/gameplay/practice";
import styles from "./ChallengeIntro.module.css";
import { useRehearsalPresentation, useChallengeRehearsalLink } from "./RehearsalPresentation";

type TransferPrompt = {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

type FullChallengeIntroProps = {
  challenge: PracticeChallenge;
  introduction?: never;
  onStart: () => void;
  note?: ReactNode;
  notice?: string;
  returnTo?: string;
  prefetchReturnLink?: boolean;
  canStart?: boolean;
  startHref?: string;
  transfer?: TransferPrompt;
};

type SafeChallengeIntroProps = {
  challenge?: never;
  introduction: SafeChallengeIntroduction;
  /** Server-backed games may start without ever serializing their question payloads. */
  onStart?: () => void;
  note?: ReactNode;
  notice?: string;
  returnTo?: string;
  prefetchReturnLink?: boolean;
  canStart: boolean;
  startHref?: string;
  transfer?: TransferPrompt;
};

export function ChallengeIntro({
  challenge,
  introduction,
  onStart,
  note,
  notice,
  returnTo = "/",
  prefetchReturnLink = true,
  canStart = true,
  startHref,
  transfer,
}: FullChallengeIntroProps | SafeChallengeIntroProps) {
  useProductSignal("challenge_intro_viewed");
  const practice = useRehearsalPresentation();
  const rehearsal = useChallengeRehearsalLink();
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
          practice ? (
            <BackButton
              label="Volver al desafío"
              onClick={() => window.location.assign(practice.returnTo)}
            />
          ) : (
            <BackLink
              href={returnTo}
              label="Volver a desafíos"
              prefetch={prefetchReturnLink ? undefined : false}
            />
          )
        }
      />

      <div className={styles.content}>
        <section className={styles.stageCard} aria-labelledby="challenge-intro-title">
          <div className={styles.cardContent}>
            <Chip tone="social">{practice ? "Partida de prueba" : model.contextLabel}</Chip>
            <h1 id="challenge-intro-title">{model.title}</h1>

            <div
              className={`${styles.metrics} ${model.metrics.length === 2 ? styles.metricsTwo : ""}`}
              aria-label="Resumen del desafío"
            >
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

            {transfer ? (
              <div className={styles.transferPrompt} role="alert">
                <p>
                  Hay una sesión activa en otro dispositivo. Puedes continuar aquí; la sesión
                  anterior quedará bloqueada.
                </p>
                <Button
                  size="hero"
                  fullWidth
                  onClick={transfer.onConfirm}
                  loading={transfer.busy}
                  disabled={transfer.busy}
                >
                  {transfer.busy ? "Continuando…" : "Continuar aquí"}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={transfer.onCancel}
                  disabled={transfer.busy}
                >
                  Mantener la sesión original
                </Button>
              </div>
            ) : null}

            {!transfer && (challenge || canStart) ? (
              startHref ? (
                <ButtonLink href={startHref} size="hero" fullWidth trailingIcon={<ArrowIcon />}>
                  {practice ? "Empezar prueba" : "Empezar desafío"}
                </ButtonLink>
              ) : (
                <Button
                  size="hero"
                  fullWidth
                  onClick={onStart}
                  disabled={!(challenge || introduction)}
                  trailingIcon={<ArrowIcon />}
                >
                  {practice ? "Empezar prueba" : "Empezar desafío"}
                </Button>
              )
            ) : null}
            {rehearsal && !practice ? (
              <ButtonLink
                href={rehearsal.href}
                prefetch={false}
                variant="secondary"
                fullWidth
                leadingIcon={<FlaskIcon />}
              >
                Probar primero
              </ButtonLink>
            ) : null}
            {note ? <p className={styles.note}>{note}</p> : null}
          </div>
        </section>
      </div>
    </motion.section>
  );
}
