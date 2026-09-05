"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SimonSequenceQuestion.module.css";
import type { QuestionVariant, SimonSequencePad } from "@/types/game";

const STEP_DURATION_MS = 560;
const STEP_GAP_MS = 180;
const PAD_SYMBOLS = ["●", "▲", "■", "◆"];

type SimonSequenceQuestionProps = {
  pads: SimonSequencePad[];
  sequence: string[];
  locked: boolean;
  onSubmit: (answer: string[]) => void;
  onTimedResponseStart: () => void;
  variant?: QuestionVariant;
};

export function SimonSequenceQuestion({
  pads,
  sequence,
  locked,
  onSubmit,
  onTimedResponseStart,
  variant,
}: SimonSequenceQuestionProps) {
  const [phase, setPhase] = useState<"playback" | "response">("playback");
  const [activePadId, setActivePadId] = useState<string | null>(null);
  const [enteredSequence, setEnteredSequence] = useState<string[]>([]);
  const firstPadRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase !== "playback") return;
    const timeouts: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      timeouts.push(window.setTimeout(callback, delay));
    };
    const playStep = (index: number) => {
      if (index >= sequence.length) {
        setPhase("response");
        onTimedResponseStart();
        return;
      }
      setActivePadId(sequence[index]);
      schedule(() => {
        setActivePadId(null);
        schedule(() => playStep(index + 1), STEP_GAP_MS);
      }, STEP_DURATION_MS);
    };
    playStep(0);
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [onTimedResponseStart, phase, sequence]);

  useEffect(() => {
    if (phase === "response") firstPadRef.current?.focus();
  }, [phase]);

  const pressPad = (padId: string) => {
    if (locked || phase !== "response") return;
    const next = [...enteredSequence, padId];
    setEnteredSequence(next);
    const currentStep = next.length - 1;
    if (sequence[currentStep] !== padId || next.length === sequence.length) {
      onSubmit(next);
    }
  };

  return (
    <section className={styles.root} data-variant={variant ?? "default"} aria-live="polite">
      <div className={styles.phaseHeader}>
        <span>{phase === "playback" ? "Observa la secuencia" : "Repite la secuencia"}</span>
        {phase === "response" && (
          <strong>
            {enteredSequence.length} de {sequence.length}
          </strong>
        )}
      </div>
      <p className={styles.instructions}>
        {phase === "playback"
          ? "Los botones se iluminarán uno a uno. Espera a que termine la reproducción."
          : "Pulsa los botones en el mismo orden en que se iluminaron."}
      </p>
      <div className={styles.pads} aria-label="Botones de la secuencia">
        {pads.map((pad, index) => {
          const active = activePadId === pad.id;
          return (
            <button
              key={pad.id}
              ref={index === 0 ? firstPadRef : undefined}
              type="button"
              className={`${styles.pad} ${styles[`pad${index}`]} ${active ? styles.padActive : ""}`}
              disabled={locked || phase === "playback"}
              onClick={() => pressPad(pad.id)}
              aria-label={`${pad.label}, botón ${index + 1}${active ? ", activo" : ""}`}
            >
              <span aria-hidden="true" className={styles.symbol}>
                {PAD_SYMBOLS[index]}
              </span>
              <strong>{pad.label}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
