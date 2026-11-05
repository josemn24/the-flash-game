"use client";

import { ShortTextInput } from "./ShortTextInput";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({ question, locked, onSubmit }: PracticeInputProps<"short-text">) {
  return <ShortTextInput question={question} locked={locked} onSubmit={onSubmit} />;
}
