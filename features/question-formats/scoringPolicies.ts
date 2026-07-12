import { QUESTION_SCORING_POLICY, type ScoringPolicyId } from "@/lib/scoring";
import type { QuestionType } from "@/types/game";

export type ScoringPolicy = {
  id: ScoringPolicyId;
  label: string;
  summary: string;
  partialCredit: boolean;
  incorrectPenalty: boolean;
  speedBonus: boolean;
};

export const SCORING_POLICIES = {
  "multiple-choice": {
    id: QUESTION_SCORING_POLICY["multiple-choice"],
    label: "Acierto y velocidad",
    summary: "Un acierto conserva entre el 50 % y el 100 % de los puntos; un fallo resta el 20 %.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  "odd-one-out": {
    id: QUESTION_SCORING_POLICY["odd-one-out"],
    label: "Acierto y velocidad",
    summary: "Un acierto conserva entre el 50 % y el 100 % de los puntos; un fallo resta el 20 %.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  matching: {
    id: QUESTION_SCORING_POLICY.matching,
    label: "Crédito por pareja",
    summary:
      "Cada pareja correcta aporta crédito ajustado por tiempo; cada intento incorrecto resta un 10 % de los puntos base.",
    partialCredit: true,
    incorrectPenalty: true,
    speedBonus: true,
  },
  "true-false": {
    id: QUESTION_SCORING_POLICY["true-false"],
    label: "Riesgo alto",
    summary:
      "Un acierto premia la velocidad y un fallo resta el 40 % por la probabilidad de acertar al azar.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  "short-text": {
    id: QUESTION_SCORING_POLICY["short-text"],
    label: "Acierto y velocidad",
    summary: "Un acierto conserva entre el 50 % y el 100 % de los puntos; los fallos no penalizan.",
    partialCredit: false,
    incorrectPenalty: false,
    speedBonus: true,
  },
  ordering: {
    id: QUESTION_SCORING_POLICY.ordering,
    label: "Secuencia exacta",
    summary:
      "La secuencia completa debe ser correcta. Un fallo resta el 20 % y la rapidez mejora el resultado.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  classification: {
    id: QUESTION_SCORING_POLICY.classification,
    label: "Crédito por elemento",
    summary:
      "Cada elemento bien clasificado aporta su fracción de puntos, ajustada por el tiempo empleado.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "logic-code": {
    id: QUESTION_SCORING_POLICY["logic-code"],
    label: "Velocidad e intentos",
    summary:
      "Solo puntúa el código correcto; cada intento fallido resta un 10 % de los puntos base.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  estimation: {
    id: QUESTION_SCORING_POLICY.estimation,
    label: "Puntuación por cercanía",
    summary: "La puntuación depende de la proximidad al valor real y se ajusta por la velocidad.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
} satisfies Record<QuestionType, ScoringPolicy>;
