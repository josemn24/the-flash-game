"use client";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
import { ShortTextInput } from "./ShortTextInput";
export function render({ question, locked, onSubmit }: CompetitiveInputProps) {
  if (question.type !== "short-text") throw new Error("unexpected_competitive_format");
  return (
    <ShortTextInput key={question.id} question={question} locked={locked} onSubmit={onSubmit} />
  );
}
