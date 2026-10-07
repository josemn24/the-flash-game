import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "multiple-choice",
  slug: "eleccion-multiple",
  name: "Elección múltiple",
  shortName: "Elección",
  summary: "Elegir una respuesta correcta entre varias alternativas, con apoyo visual opcional.",
  description: [
    "El jugador compara varias opciones y toca una para responder inmediatamente. Es un formato rápido, familiar y muy versátil.",
    "Puede incorporar una imagen sin convertirse en otra mecánica: el medio aporta contexto, pero las reglas no cambian.",
  ],
  recommendations: [
    "Comprobar conocimientos concretos",
    "Reconocimiento visual",
    "Rondas rápidas con dificultad gradual",
  ],
  avoidWhen: [
    "Varias respuestas podrían ser defendibles",
    "Se quiere evaluar razonamiento abierto",
    "Las alternativas revelarían la solución",
  ],
  rules: [
    "Tocar una opción envía la respuesta inmediatamente",
    "La respuesta queda bloqueada al enviarse",
    "Agotar el tiempo equivale a no responder",
  ],
  authoringTips: [
    "Usa distractores plausibles y homogéneos",
    "Evita pistas gramaticales o una opción mucho más larga",
    "Formula el enunciado de manera autosuficiente",
  ],
  accessibility: [
    "No dependas solo del color para distinguir opciones",
    "Toda imagen debe tener texto alternativo útil",
    "Mantén áreas táctiles amplias",
  ],
  mediaSupport: ["Texto", "Imagen o ilustración opcional"],
  timing: {
    recommendedSeconds: "8–15 s",
    notes: "Añade tiempo si hay que interpretar una imagen o leer opciones extensas.",
  },
  scoring: SCORING_POLICIES["multiple-choice"],
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-choice",
        type: "multiple-choice",
        category: "Geografía",
        tags: {
          domains: ["geography"],
          topics: ["capitals"],
          cognitiveSkills: ["memory"],
          formatSkills: ["recall"],
        },
        question: "¿Cuál es la capital de Canadá?",
        options: ["Toronto", "Ottawa", "Vancouver", "Montreal"],
        correctAnswer: "Ottawa",
        timeLimit: 12,
        points: 100,
        explanation: "Ottawa es la capital de Canadá.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"multiple-choice">;
