"use client";

import { TrueFalseQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"true-false">>) {
  return <TrueFalseQuestion locked={locked} onSubmit={onSubmit} />;
}
