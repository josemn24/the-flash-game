"use client";

import { motion } from "motion/react";
import { BoltIcon, CheckIcon, ClockIcon, CrossIcon } from "@/components/icons";
import styles from "@/components/QuestionTransition.module.css";
import type { AnswerStatus } from "@/types/game";

function getTransitionCopy({
  timedOut,
  isLast,
  status,
  eliminated,
}: {
  timedOut: boolean;
  isLast: boolean;
  status?: AnswerStatus;
  eliminated?: boolean;
}) {
  if (eliminated) {
    return {
      tone: "danger",
      title: "Sin vidas",
      body: "Calculando hasta dónde has llegado.",
    };
  }
  if (timedOut) {
    return {
      tone: "danger",
      title: "Tiempo agotado",
      body: isLast ? "Calculando tu resultado..." : "Pierdes una vida. Sigue si quedan fuerzas.",
    };
  }
  if (status === "incorrect") {
    return {
      tone: "danger",
      title: "Respuesta fallada",
      body: isLast ? "Calculando tu resultado..." : "Pierdes una vida. Siguiente reto en marcha.",
    };
  }
  if (status === "partial") {
    return {
      tone: "partial",
      title: "Aproximación válida",
      body: isLast ? "Calculando tu resultado..." : "Suma puntos y conservas tus vidas.",
    };
  }
  return {
    tone: "success",
    title: timedOut ? "Tiempo agotado" : "Respuesta enviada",
    body: isLast
      ? "Calculando tu resultado..."
      : timedOut
        ? "No pares. Sigue el sprint."
        : "Siguiente pregunta en marcha.",
  };
}

export function QuestionTransition({
  timedOut,
  isLast,
  status,
  eliminated,
}: {
  timedOut: boolean;
  isLast: boolean;
  status?: AnswerStatus;
  eliminated?: boolean;
}) {
  const copy = getTransitionCopy({ timedOut, isLast, status, eliminated });
  const isDanger = copy.tone === "danger";
  const isPartial = copy.tone === "partial";

  return (
    <motion.section
      className="grid min-h-[100dvh] place-items-center px-5 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      aria-live="polite"
    >
      <div>
        <motion.div
          className={`${styles.icon} ${isDanger ? styles.iconTime : isPartial ? styles.iconPartial : ""}`}
          initial={{ scale: 0.5, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 18 }}
        >
          {timedOut ? (
            <ClockIcon className="h-9 w-9" />
          ) : isDanger ? (
            <CrossIcon className="h-9 w-9" />
          ) : (
            <CheckIcon className="h-9 w-9" />
          )}
        </motion.div>
        <motion.h1
          className="mt-6 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
        >
          {copy.title}
        </motion.h1>
        <p className="mt-2 text-sm font-bold text-white/40">{copy.body}</p>
        <div className="mt-7 flex justify-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <motion.span
              key={item}
              className="h-1.5 w-8 skew-x-[-28deg] bg-[var(--electric)]"
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.15, 1, 0.15] }}
              transition={{ duration: 0.55, repeat: Infinity, delay: item * 0.1 }}
            />
          ))}
        </div>
      </div>
      <BoltIcon
        className="absolute bottom-6 right-6 h-12 w-12 text-white/[0.03]"
        aria-hidden="true"
      />
    </motion.section>
  );
}
