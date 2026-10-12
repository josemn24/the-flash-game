"use client";

import { HeatMapQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"heat-map">>) {
  return <HeatMapQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}
