"use client";

import type { ComponentType } from "react";
import type { QuestionInputProps } from "./rendererTypes";
import { QUESTION_INPUT_RENDERERS } from "./practiceInputRegistry";
import styles from "./QuestionInput.module.css";

export { QUESTION_INPUT_RENDERERS } from "./practiceInputRegistry";

export function QuestionInput(props: QuestionInputProps) {
  const Renderer = QUESTION_INPUT_RENDERERS[
    props.question.type
  ] as ComponentType<QuestionInputProps>;
  return (
    <div
      className={styles.questionInput}
      data-format={props.question.type}
      aria-busy={props.submissionState === "submitting" || undefined}
    >
      <Renderer {...props} />
    </div>
  );
}
