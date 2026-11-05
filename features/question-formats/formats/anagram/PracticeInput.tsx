"use client";

import { AnagramQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({ question, locked, onSubmit }: PracticeInputProps<"anagram">) {
  return (
    <AnagramQuestion
      tiles={question.tiles}
      hint={question.hint}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}
