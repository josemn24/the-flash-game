"use client";

import { motion } from "motion/react";
import { ChangeEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { ArrowIcon } from "@/components/icons";
import styles from "@/components/LogicCodeQuestion.module.css";
import type { LogicCodeClue } from "@/types/game";

type LogicCodeQuestionProps = {
  clues: LogicCodeClue[];
  codeLength: number;
  initialDraft?: string;
  locked: boolean;
  attemptCount: number;
  onProgress?: (code: string) => void;
  onAttempt: (code: string) => boolean;
  variant?: "flash-pop";
};

export function LogicCodeQuestion({
  clues,
  codeLength,
  initialDraft,
  locked,
  attemptCount,
  onProgress,
  onAttempt,
  variant,
}: LogicCodeQuestionProps) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: codeLength }, (_, index) => initialDraft?.[index] ?? ""),
  );
  const [feedback, setFeedback] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);

  const updateDigit = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const incoming = event.target.value.replace(/\D/g, "");
    if (!incoming) {
      const next = digits.map((digit, digitIndex) => (digitIndex === index ? "" : digit));
      setDigits(next);
      onProgress?.(next.join(""));
      return;
    }

    const nextDigits = [...digits];
    incoming
      .slice(0, codeLength - index)
      .split("")
      .forEach((digit, offset) => {
        nextDigits[index + offset] = digit;
      });
    setFeedback("");
    setDigits(nextDigits);
    onProgress?.(nextDigits.join(""));
    const nextIndex = Math.min(index + incoming.length, codeLength - 1);
    inputRefs.current[nextIndex]?.focus();
    inputRefs.current[nextIndex]?.select();
  };

  const submit = () => {
    if (locked || code.length !== codeLength) return;
    const correct = onAttempt(code);
    if (!correct) {
      setDigits(Array(codeLength).fill(""));
      onProgress?.("");
      setFeedback("Código incorrecto. Prueba otra combinación.");
      inputRefs.current[0]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
      const next = digits.map((digit, digitIndex) => (digitIndex === index - 1 ? "" : digit));
      setDigits(next);
      onProgress?.(next.join(""));
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < codeLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className={`${styles.challenge} ${variant === "flash-pop" ? styles.pop : ""}`}>
      <div className={styles.clues} aria-label="Pistas del código">
        {clues.map((clue) => (
          <div className={styles.clue} key={clue.code}>
            <strong>{clue.code}</strong>
            <span>{clue.hint}</span>
          </div>
        ))}
      </div>

      <div className={styles.entryPanel}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-white/65">Introduce el código</span>
          <span className="font-mono text-[10px] font-bold tracking-wider text-white/35 uppercase">
            {attemptCount} {attemptCount === 1 ? "intento incorrecto" : "intentos incorrectos"}
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
          {feedback || "Cada intento incorrecto reduce la puntuación. El reloj sigue corriendo."}
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
      </div>
    </div>
  );
}
