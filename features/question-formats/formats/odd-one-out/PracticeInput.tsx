"use client";

import { OddOneOutQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"odd-one-out">>) {
  return <OddOneOutQuestion items={question.items} locked={locked} onSubmit={onSubmit} />;
}
