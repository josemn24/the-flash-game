"use client";

import { ImageLabelingQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: PracticeInputProps<"image-labeling">) {
  return <ImageLabelingQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}
