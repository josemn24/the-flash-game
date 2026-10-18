"use client";

import { SessionQuestionStage } from "./SessionQuestionStage";
import type { SessionQuestionStageProps } from "./SessionQuestionStage";

/** Compatibility facade for existing competitive mode compositions. */
export function ServerFlashQuestionStage(props: SessionQuestionStageProps) {
  return <SessionQuestionStage {...props} />;
}
