"use client";

import type { PracticeInput } from "./practiceInputTypes";
import { renderPracticeInput } from "./practiceInputRegistry";
import styles from "./QuestionInput.module.css";

export { QUESTION_INPUT_RENDERERS } from "./practiceInputRegistry";

export function QuestionInput({ input }: { input: PracticeInput }) {
  return (
    <div className={styles.questionInput} data-format={input.format}>
      {renderPracticeInput(input)}
    </div>
  );
}
