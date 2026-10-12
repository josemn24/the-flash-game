"use client";
import { ArrowIcon } from "@/components/ui";
import styles from "@/features/question-formats/QuestionInput.module.css";
import textStyles from "@/features/question-formats/TextAnswerControls.module.css";
import { motion } from "motion/react";
import type { FormEvent } from "react";
import { useState } from "react";
export function ShortTextInput({
  question,
  locked,
  onSubmit,
}: {
  question: { id: string; answerPlaceholder?: string | null };
  locked: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = answer.trim();
    if (value && !locked) onSubmit(value);
  };

  return (
    <form className="mt-8" onSubmit={submit}>
      <label className={textStyles.label} htmlFor={`answer-${question.id}`}>
        Escribe tu respuesta
      </label>
      <div className={textStyles.row}>
        <input
          id={`answer-${question.id}`}
          className={textStyles.input}
          type="text"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={question.answerPlaceholder ?? "Tu respuesta…"}
          disabled={locked}
          autoComplete="off"
          autoFocus
        />
        <motion.button
          className={styles.textSubmitButton}
          type="submit"
          disabled={locked || !answer.trim()}
          whileTap={{ scale: 0.96 }}
          aria-label="Enviar respuesta"
        >
          <ArrowIcon className="h-6 w-6" />
        </motion.button>
      </div>
      <p className={textStyles.hint}>No importan las mayúsculas, las tildes ni los espacios.</p>
    </form>
  );
}
