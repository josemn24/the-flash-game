import type { QuestionType } from "@/types/game";

export type ScoringPolicy = {
  id: "binary-speed" | "partial-items" | "attempt-penalty" | "proximity";
  label: string;
  summary: string;
  partialCredit: boolean;
  incorrectPenalty: boolean;
  speedBonus: boolean;
};

export const SCORING_POLICIES = {
  "multiple-choice": {
    id: "binary-speed",
    label: "Acierto y velocidad",
    summary: "Un acierto conserva entre el 50 % y el 100 % de los puntos; un fallo resta el 20 %.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  "odd-one-out": {
    id: "binary-speed",
    label: "Acierto y velocidad",
    summary: "Un acierto conserva entre el 50 % y el 100 % de los puntos; un fallo resta el 20 %.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  "true-false": {
    id: "binary-speed",
    label: "Riesgo alto",
    summary:
      "Un acierto premia la velocidad y un fallo resta el 40 % por la probabilidad de acertar al azar.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  "short-text": {
    id: "binary-speed",
    label: "Acierto y velocidad",
    summary: "Un acierto conserva entre el 50 % y el 100 % de los puntos; los fallos no penalizan.",
    partialCredit: false,
    incorrectPenalty: false,
    speedBonus: true,
  },
  ordering: {
    id: "binary-speed",
    label: "Secuencia exacta",
    summary:
      "La secuencia completa debe ser correcta. Un fallo resta el 20 % y la rapidez mejora el resultado.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  classification: {
    id: "partial-items",
    label: "Crédito por elemento",
    summary:
      "Cada elemento bien clasificado aporta su fracción de puntos, ajustada por el tiempo empleado.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "logic-code": {
    id: "attempt-penalty",
    label: "Velocidad e intentos",
    summary:
      "Solo puntúa el código correcto; cada intento fallido resta un 10 % de los puntos base.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  estimation: {
    id: "proximity",
    label: "Puntuación por cercanía",
    summary: "La puntuación depende de la proximidad al valor real y se ajusta por la velocidad.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
} satisfies Record<QuestionType, ScoringPolicy>;
