"use client";

import { motion } from "motion/react";
import { NotebookIcon, GameHeader } from "@/components/ui";
import { Logo } from "@/components/navigation/Logo";
import type { AnswerResult, Challenge } from "@/types/game";
import { buildReviewAnswerEntries } from "./ReviewAnswerList";
import { ReviewAnswerPanel } from "./ReviewAnswerPanel";
import styles from "./ReviewAnswers.module.css";

export function ReviewAnswers({
  challenge,
  results,
  onBack,
  onReplay,
  notebook,
}: {
  challenge: Challenge;
  results: AnswerResult[];
  onBack: () => void;
  onReplay?: () => void;
  notebook?: { entryCount: number; onOpen: () => void };
}) {
  const entries = buildReviewAnswerEntries(challenge, results);
  const answeredCount = entries.filter((entry) => entry.result).length;
  const description =
    challenge.mode === "narrative"
      ? "Contrasta tus respuestas con el registro científico y revisa cada decisión."
      : "Consulta tu respuesta, la solución aceptada y la explicación de cada desafío.";

  return (
    <motion.section
      className={styles.reviewScreen}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <GameHeader
        className={styles.reviewScreenHeader}
        left={<Logo />}
        right={
          <div className={styles.reviewHeaderActions}>
            {notebook ? (
              <motion.button
                type="button"
                className={styles.textButton}
                onClick={notebook.onOpen}
                whileTap={{ scale: 0.98 }}
                aria-label={`Abrir cuaderno de campo, ${notebook.entryCount} entradas`}
              >
                <NotebookIcon className="h-4 w-4" />
                Cuaderno · {notebook.entryCount}
              </motion.button>
            ) : null}
            <motion.button
              type="button"
              className={styles.textButton}
              onClick={onBack}
              whileTap={{ scale: 0.98 }}
            >
              Volver al resultado
            </motion.button>
          </div>
        }
      />

      <ReviewAnswerPanel
        entries={entries}
        countLabel={`${answeredCount} respuestas`}
        description={description}
        onBack={onBack}
        onReplay={onReplay}
      />
    </motion.section>
  );
}
