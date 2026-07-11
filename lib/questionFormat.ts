import type { QuestionType } from "@/types/game";

export const QUESTION_FORMAT_LABELS = {
  "multiple-choice": "Elección",
  "true-false": "V/F",
  "short-text": "Texto",
  "image-choice": "Imagen",
} satisfies Record<QuestionType, string>;
