"use client";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
import { ShortTextInput } from "./ShortTextInput";
export function render({ question, locked, onSubmit }: CompetitiveInputProps<"short-text">) {
  return (
    <ShortTextInput key={question.id} question={question} locked={locked} onSubmit={onSubmit} />
  );
}
