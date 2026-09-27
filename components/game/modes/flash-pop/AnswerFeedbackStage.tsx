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

export function AnswerFeedbackStage(props: AnswerFeedbackStageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const checking = props.state === "checking";
  const indicatorVisible = checking ? props.indicatorVisible : true;

  useEffect(() => {
    headingRef.current?.focus();
  }, [props.state, indicatorVisible]);

  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={checking || undefined}
      aria-label={checking ? "Comprobando respuesta" : undefined}
      data-feedback-state={props.state}
    >
      <motion.div
        className={styles.stage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Card className={`${styles.card} ${props.state === "error" ? styles.error : ""}`}>
          {checking && indicatorVisible ? (
            <span className={styles.icon} aria-hidden="true">
              <span className={styles.spinner} />
            </span>
          ) : !checking ? (
            <span className={`${styles.icon} ${styles.errorIcon}`} aria-hidden="true">
              <WarningIcon />
            </span>
          ) : null}
          {indicatorVisible || !checking ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>
                {checking ? "Comprobando respuesta…" : "No hemos podido confirmar tu respuesta"}
              </h1>
              <p>{checking ? "Espera un momento…" : props.errorMessage}</p>
            </>
          ) : null}
          {props.state === "error" ? (
            <Button type="button" onClick={props.onRetry}>
              Reintentar
            </Button>
          ) : null}
        </Card>
      </motion.div>
    </div>
  );
}
