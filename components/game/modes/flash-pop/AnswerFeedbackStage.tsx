"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Button, Card, WarningIcon } from "@/components/ui";
import styles from "./AnswerFeedbackStage.module.css";

export type AnswerFeedbackStageProps =
  | {
      readonly state: "checking";
      readonly indicatorVisible: boolean;
    }
  | {
      readonly state: "error";
      readonly indicatorVisible?: never;
      readonly errorMessage: string;
      readonly onRetry: () => void;
    };

function PendingFeedbackStage({
  state,
  indicatorVisible,
  title,
  description,
  onRetry,
}: {
  state: "checking" | "loading-question" | "error";
  indicatorVisible: boolean;
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pending = state !== "error";

  useEffect(() => {
    headingRef.current?.focus();
  }, [state, indicatorVisible]);

  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={pending || undefined}
      aria-label={pending ? title.replace(/…$/, "") : undefined}
      data-feedback-state={state}
    >
      <motion.div
        className={styles.stage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Card className={`${styles.card} ${state === "error" ? styles.error : ""}`}>
          {pending && indicatorVisible ? (
            <span className={styles.icon} aria-hidden="true">
              <span className={styles.spinner} />
            </span>
          ) : !pending ? (
            <span className={`${styles.icon} ${styles.errorIcon}`} aria-hidden="true">
              <WarningIcon />
            </span>
          ) : null}
          {indicatorVisible || !pending ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>
                {title}
              </h1>
              <p>{description}</p>
            </>
          ) : null}
          {state === "error" && onRetry ? (
            <Button type="button" onClick={onRetry}>
              Reintentar
            </Button>
          ) : null}
        </Card>
      </motion.div>
    </div>
  );
}

export function AnswerFeedbackStage(props: AnswerFeedbackStageProps) {
  const checking = props.state === "checking";
  return (
    <PendingFeedbackStage
      state={props.state}
      indicatorVisible={checking ? props.indicatorVisible : true}
      title={checking ? "Comprobando respuesta…" : "No hemos podido confirmar tu respuesta"}
      description={checking ? "Espera un momento…" : props.errorMessage}
      onRetry={props.state === "error" ? props.onRetry : undefined}
    />
  );
}

export function QuestionLoadingStage() {
  return (
    <PendingFeedbackStage
      state="loading-question"
      indicatorVisible
      title="Cargando pregunta…"
      description="Espera un momento…"
    />
  );
}
