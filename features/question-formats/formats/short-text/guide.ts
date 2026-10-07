import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "short-text",
  slug: "respuesta-corta",
  name: "Respuesta corta",
  shortName: "Texto",
  summary: "Escribir una palabra, nombre, cifra o expresión breve sin opciones visibles.",
  description: [
    "Evalúa recuerdo activo: el jugador debe producir la respuesta en lugar de reconocerla entre alternativas.",
  ],
  recommendations: [
    "Nombres propios y fechas",
    "Vocabulario específico",
    "Evitar que las opciones den pistas",
  ],
  avoidWhen: [
    "Hay muchas formulaciones equivalentes",
    "La ortografía no debería condicionar el resultado",
    "La respuesta requiere varias frases",
  ],
  rules: [
    "Se normalizan mayúsculas, tildes y espacios",
    "Pueden definirse respuestas alternativas",
    "Una respuesta incorrecta no resta puntos",
  ],
  authoringTips: [
    "Indica la unidad cuando corresponda",
    "Incluye variantes comunes aceptables",
    "Pide una respuesta claramente acotada",
  ],
  accessibility: [
    "Asocia una etiqueta visible al campo",
    "Permite enviar con teclado",
    "No uses el placeholder como única instrucción",
  ],
  mediaSupport: ["Texto"],
  timing: {
    recommendedSeconds: "10–18 s",
    notes: "Reserva tiempo adicional para escribir, especialmente en móvil.",
  },
  scoring: SCORING_POLICIES["short-text"],
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-short-text",
        type: "short-text",
        category: "Historia",
        tags: {
          domains: ["history"],
          topics: ["world_war_ii"],
          cognitiveSkills: ["memory"],
          formatSkills: ["recall"],
        },
        question: "¿En qué año terminó la Segunda Guerra Mundial?",
        correctAnswer: "1945",
        acceptedAnswers: ["1945", "mil novecientos cuarenta y cinco"],
        timeLimit: 13,
        points: 120,
        explanation: "La Segunda Guerra Mundial terminó en 1945.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"short-text">;
