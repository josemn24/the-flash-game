import type { QuestionType } from "@/types/game";

export const QUESTION_FORMAT_LABELS = {
  "multiple-choice": "Elección",
  "true-false": "V/F",
  "short-text": "Texto",
  "image-choice": "Imagen",
  ordering: "Ordenar",
  classification: "Clasificar",
  "logic-code": "Código lógico",
  estimation: "Estimación",
} satisfies Record<QuestionType, string>;
