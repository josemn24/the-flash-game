"use client";

import { HeatMapQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({ question, locked, onSubmit }: PracticeInputProps<"heat-map">) {
  return <HeatMapQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}
