import type { QuestionType } from "@/types/game";

export const QUESTION_FORMAT_LABELS = {
  "multiple-choice": "Elección",
  "odd-one-out": "Intruso",
  matching: "Emparejar",
  "true-false": "V/F",
  "short-text": "Texto",
  ordering: "Ordenar",
  classification: "Clasificar",
  "logic-code": "Código lógico",
  estimation: "Estimación",
} satisfies Record<QuestionType, string>;
