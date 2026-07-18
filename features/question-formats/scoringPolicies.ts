import { QUESTION_SCORING_POLICY, type ScoringPolicyId } from "@/lib/scoring";
import type { QuestionType } from "@/types/game";

export type ScoringPolicy = {
  id: ScoringPolicyId;
  label: string;
  summary: string;
  partialCredit: boolean;
  incorrectPenalty: boolean;
  speedBonus: boolean;
  partialCreditLabel?: string;
  incorrectPenaltyLabel?: string;
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
  "progressive-clues": {
    id: QUESTION_SCORING_POLICY["progressive-clues"],
    label: "Pistas y velocidad",
    summary:
      "Cada pista adicional reduce el máximo disponible; una respuesta correcta conserva entre el 50 % y el 100 % de ese máximo según el tiempo.",
    partialCredit: false,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "progressive-image": {
    id: QUESTION_SCORING_POLICY["progressive-image"],
    label: "Reconocimiento y velocidad",
    summary:
      "Un acierto conserva entre el 50 % y el 100 % de los puntos; responder antes revela menos imagen y conserva más puntos.",
    partialCredit: false,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "heat-map": {
    id: QUESTION_SCORING_POLICY["heat-map"],
    label: "Precisión espacial",
    summary:
      "La zona objetivo concede precisión completa; alrededor, los puntos disminuyen con la distancia y se ajustan por velocidad.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "image-labeling": {
    id: QUESTION_SCORING_POLICY["image-labeling"],
    label: "Crédito por etiqueta",
    summary:
      "El etiquetado múltiple concede crédito por zona; la identificación única es binaria y se ajusta por velocidad.",
    partialCredit: true,
    incorrectPenalty: true,
    speedBonus: true,
    partialCreditLabel: "Crédito parcial en múltiple",
    incorrectPenaltyLabel: "Elección incorrecta −20 %",
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
  "flash-memory": {
    id: QUESTION_SCORING_POLICY["flash-memory"],
    label: "Crédito por posición",
    summary:
      "Cada ficha colocada en la posición correcta aporta su fracción de puntos, ajustada por el tiempo de reconstrucción.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "simon-sequence": {
    id: QUESTION_SCORING_POLICY["simon-sequence"],
    label: "Secuencia y velocidad",
    summary:
      "La secuencia debe repetirse exactamente; un acierto conserva entre el 50 % y el 100 % de los puntos según el tiempo de respuesta.",
    partialCredit: false,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "logic-matrix": {
    id: QUESTION_SCORING_POLICY["logic-matrix"],
    label: "Acierto y velocidad",
    summary: "Un acierto conserva entre el 50 % y el 100 % de los puntos; un fallo resta el 20 %.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
  },
  "mini-sudoku": {
    id: QUESTION_SCORING_POLICY["mini-sudoku"],
    label: "Crédito por casilla",
    summary:
      "Cada casilla vacía correcta aporta su fracción de puntos, ajustada por el tiempo empleado al completar el sudoku.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "mini-nonogram": {
    id: QUESTION_SCORING_POLICY["mini-nonogram"],
    label: "Crédito neto por relleno",
    summary:
      "Cada relleno correcto suma y cada relleno erróneo resta crédito; el resultado nunca baja de cero y se ajusta por velocidad.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "sliding-puzzle": {
    id: QUESTION_SCORING_POLICY["sliding-puzzle"],
    label: "Resolución y velocidad",
    summary:
      "Solo resolver el tablero concede entre el 50 % y el 100 % de los puntos según el tiempo; los movimientos no penalizan.",
    partialCredit: false,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "error-reconstruction": {
    id: QUESTION_SCORING_POLICY["error-reconstruction"],
    label: "Localización y corrección",
    summary:
      "Localizar el primer error aporta el 60 %; corregirlo exactamente completa el 100 %, con ajuste por velocidad.",
    partialCredit: true,
    incorrectPenalty: false,
    speedBonus: true,
    partialCreditLabel: "60 % por localizar",
  },
  anagram: {
    id: QUESTION_SCORING_POLICY.anagram,
    label: "Acierto y velocidad",
    summary:
      "Formar la palabra exacta conserva entre el 50 % y el 100 % de los puntos; un fallo o timeout no puntúa.",
    partialCredit: false,
    incorrectPenalty: false,
    speedBonus: true,
  },
  "mini-wordle": {
    id: QUESTION_SCORING_POLICY["mini-wordle"],
    label: "Velocidad e intentos",
    summary:
      "Resolver conserva puntos según el tiempo; cada intento incorrecto previo resta un 10 % de los puntos base.",
    partialCredit: false,
    incorrectPenalty: true,
    speedBonus: true,
    incorrectPenaltyLabel: "Cada intento fallido −10 %",
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
