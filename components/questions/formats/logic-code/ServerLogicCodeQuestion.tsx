"use client";

import { motion } from "motion/react";
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowIcon } from "@/components/ui";
import { ServerOperationStatus } from "@/components/questions/shared";
import type { ServerLogicCodeProgress } from "@/types/gameplay/challenge";
import styles from "./LogicCodeQuestion.module.css";

export function ServerLogicCodeQuestion({
  clues,
  codeLength,
  progress,
  locked,
  submissionState,
  submissionStatusVisible,
  submissionError,
  onRetry,
  onSubmit,
}: {
  readonly clues: readonly { readonly code: string; readonly hint: string }[];
  readonly codeLength: number;
  readonly progress: ServerLogicCodeProgress;
  readonly locked: boolean;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onRetry?: () => void;
  readonly onSubmit: (code: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: codeLength }, () => ""),
  );
  const [feedback, setFeedback] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const previousAttemptCount = useRef(progress.submittedCodes.length);
  const code = useMemo(() => digits.join(""), [digits]);

  useEffect(() => {
    if (progress.submittedCodes.length > previousAttemptCount.current) {
      setDigits(Array(codeLength).fill(""));
      setFeedback("Código incorrecto. Prueba otra combinación.");
      inputRefs.current[0]?.focus();
    }
    previousAttemptCount.current = progress.submittedCodes.length;
  }, [codeLength, progress.submittedCodes.length]);

  const updateDigit = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const incoming = event.target.value.replace(/\D/g, "");
    const next = [...digits];
    if (!incoming) {
      next[index] = "";
      setDigits(next);
      return;
    }
    incoming
      .slice(0, codeLength - index)
      .split("")
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });
    setFeedback("");
    setDigits(next);
    const nextIndex = Math.min(index + incoming.length, codeLength - 1);
    inputRefs.current[nextIndex]?.focus();
    inputRefs.current[nextIndex]?.select();
  };

  const submit = () => {
    if (locked || code.length !== codeLength) return;
    onSubmit(code);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < codeLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const statusText =
    submissionState === "idle"
      ? (submissionError ?? feedback) ||
        "Cada intento incorrecto reduce la puntuación. El reloj sigue corriendo."
      : "";

  return (
    <div className={styles.challenge}>
      <div className={styles.clues} aria-label="Pistas del código">
        {clues.map((clue) => (
          <div className={styles.clue} key={clue.code}>
            <strong>{clue.code}</strong>
            <span>{clue.hint}</span>
          </div>
        ))}
      </div>

      {progress.submittedCodes.length > 0 ? (
        <div className="grid gap-2" aria-label="Códigos enviados">
          <span className="text-xs font-bold uppercase tracking-wide">Códigos enviados</span>
          <div className="flex flex-wrap gap-2">
            {progress.submittedCodes.map((submittedCode, index) => (
              <span
                className="rounded-md border px-2 py-1 font-mono text-sm"
                key={`${submittedCode}-${index}`}
              >
                {submittedCode}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.entryPanel}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold">Introduce el código</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
            {progress.incorrectAttempts}{" "}
            {progress.incorrectAttempts === 1 ? "intento incorrecto" : "intentos incorrectos"}
          </span>
        </div>
        <div className={styles.codeDisplay} role="group" aria-label="Introduce el código numérico">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              className={`${styles.digitInput} ${digit ? styles.filled : ""}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint={index === codeLength - 1 ? "go" : "next"}
              autoComplete="off"
              autoFocus={index === 0}
              maxLength={index === 0 ? codeLength : 1}
              value={digit}
              disabled={locked}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateDigit(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              aria-label={`Cifra ${index + 1} de ${codeLength}`}
            />
          ))}
        </div>
        <p className={styles.feedback} role="status" aria-live="polite">
          {statusText}
        </p>
        <motion.button
          type="button"
          className={styles.submitButton}
          disabled={locked || code.length !== codeLength}
          onClick={submit}
          whileTap={{ scale: 0.97 }}
        >
          Enviar código
          <ArrowIcon className="h-5 w-5" />
        </motion.button>
        <ServerOperationStatus
          state={submissionState}
          visible={submissionStatusVisible}
          pendingMessage="Comprobando código…"
          errorMessage={submissionError ?? "No hemos podido confirmar tu código."}
          retryLabel="Reintentar"
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}
