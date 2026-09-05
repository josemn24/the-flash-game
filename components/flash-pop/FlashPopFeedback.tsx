"use client";

import { motion } from "motion/react";
import { CheckIcon, ClockIcon, CrossIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import type { AnswerStatus } from "@/types/game";
import styles from "./FlashPopFeedback.module.css";

type Props = {
  status: AnswerStatus;
  eyebrow?: string;
  title: string;
  body: string;
  points?: number;
};

function FeedbackIcon({ status }: { status: AnswerStatus }) {
  if (status === "unanswered") return <ClockIcon aria-hidden="true" />;
  if (status === "incorrect") return <CrossIcon aria-hidden="true" />;
  return <CheckIcon aria-hidden="true" />;
}

export function FlashPopFeedback({ status, eyebrow, title, body, points }: Props) {
  const failure = status === "incorrect" || status === "unanswered";

  return (
    <div className={styles.root} role="status" aria-live="polite" aria-atomic="true">
      <motion.div
        className={styles.stage}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className={`${styles.card} ${failure ? styles.failure : ""}`}>
          <motion.span
            className={styles.icon}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              failure
                ? { duration: 0.2 }
                : { type: "spring", stiffness: 280, damping: 16, delay: 0.08 }
            }
          >
            <FeedbackIcon status={status} />
          </motion.span>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1>{title}</h1>
          <p>{body}</p>
          {typeof points === "number" ? (
            <motion.p
              className={styles.points}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.25 }}
            >
              {points > 0 ? "+" : ""}
              {points} puntos
            </motion.p>
          ) : null}
        </Card>
      </motion.div>
    </div>
  );
}
