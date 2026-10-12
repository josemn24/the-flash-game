import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "logic-code",
  slug: "codigo-logico",
  name: "Código lógico",
  shortName: "Código",
  summary: "Deducir un código a partir de varias pistas y gestionar los intentos.",
  description: [
    "Combina deducción, descarte y prueba de hipótesis. Las pistas describen qué partes de varios códigos son válidas.",
  ],
  recommendations: ["Retos finales", "Pensamiento deductivo", "Rondas con tensión creciente"],
  avoidWhen: [
    "Las pistas admiten más de una solución",
    "No hay tiempo suficiente para comprobar hipótesis",
    "El público no conoce la convención de las pistas",
  ],
  rules: [
    "El código debe tener la longitud indicada",
    "Se permiten varios intentos hasta acertar o agotar el tiempo",
    "Cada fallo reduce la puntuación final",
  ],
  authoringTips: [
    "Verifica la solución de forma independiente",
    "Ordena las pistas para permitir progreso",
    "Evita pistas redundantes o ambiguas",
  ],
  accessibility: [
    "Expresa cada pista como texto completo",
    "Mantén visibles los intentos anteriores",
    "Usa campos con etiquetas accesibles",
  ],
  mediaSupport: ["Códigos y pistas de texto"],
  timing: {
    recommendedSeconds: "20–40 s",
    notes: "Necesita más tiempo que una pregunta de recuerdo o reconocimiento.",
  },
  scoring: SCORING_POLICIES["logic-code"],
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-logic-code",
        type: "logic-code",
        category: "Lógica",
        tags: {
          domains: ["mathematics"],
          topics: ["logic_puzzles"],
          cognitiveSkills: ["logical_reasoning", "problem_solving"],
          formatSkills: ["deduction"],
        },
        question: "Deduce el código secreto de tres cifras.",
        clues: [
          { code: "682", hint: "Una cifra es correcta y está bien colocada." },
          { code: "614", hint: "Una cifra es correcta, pero está mal colocada." },
          {
            code: "206",
            hint: "Dos cifras son correctas, pero están mal colocadas.",
          },
          { code: "738", hint: "Ninguna cifra es correcta." },
          { code: "780", hint: "Una cifra es correcta, pero está mal colocada." },
        ],
        codeLength: 3,
        correctAnswer: "042",
        timeLimit: 25,
        points: 150,
        explanation: "Las pistas permiten descartar cifras y posiciones hasta llegar a 042.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"logic-code">;
