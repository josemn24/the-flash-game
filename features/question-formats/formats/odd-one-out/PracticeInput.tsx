"use client";

import { OddOneOutQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({ question, locked, onSubmit }: PracticeInputProps<"odd-one-out">) {
  return <OddOneOutQuestion items={question.items} locked={locked} onSubmit={onSubmit} />;
}
