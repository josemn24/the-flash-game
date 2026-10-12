"use client";

import { ImageLabelingQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"image-labeling">>) {
  return <ImageLabelingQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}
