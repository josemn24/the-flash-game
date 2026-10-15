"use client";

import { TrueFalseQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({ locked, onSubmit }: PracticeInputProps<"true-false">) {
  return <TrueFalseQuestion locked={locked} onSubmit={onSubmit} />;
}
