import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "true-false",
  slug: "verdadero-falso",
  name: "Verdadero o falso",
  shortName: "V/F",
  summary: "Decidir rápidamente si una afirmación es correcta o incorrecta.",
  description: [
    "Presenta una afirmación inequívoca y obliga a tomar una decisión binaria. Su sencillez permite imprimir mucho ritmo.",
  ],
  recommendations: [
    "Detectar conceptos erróneos frecuentes",
    "Activar una sesión",
    "Intercalar preguntas de alta velocidad",
  ],
  avoidWhen: [
    "La afirmación depende del contexto",
    "Existen excepciones relevantes",
    "Se necesita distinguir más de dos alternativas",
  ],
  rules: [
    "Se responde con Verdadero o Falso",
    "La selección se envía inmediatamente",
    "Los fallos tienen una penalización mayor",
  ],
  authoringTips: [
    "Evita dobles negaciones",
    "No uses absolutos salvo que sean esenciales",
    "Comprueba que solo exista una interpretación razonable",
  ],
  accessibility: [
    "Acompaña iconos y colores con texto",
    "No uses únicamente posición izquierda/derecha como instrucción",
  ],
  mediaSupport: ["Texto"],
  timing: {
    recommendedSeconds: "6–10 s",
    notes: "La lectura debe ser breve; una afirmación larga desvirtúa el formato.",
  },
  scoring: SCORING_POLICIES["true-false"],
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-true-false",
        type: "true-false",
        category: "Ciencia",
        tags: {
          domains: ["natural_sciences"],
          topics: ["sound_waves"],
          cognitiveSkills: ["scientific_reasoning"],
          formatSkills: ["interpretation"],
        },
        question: "El sonido puede viajar por el vacío del espacio.",
        correctAnswer: false,
        timeLimit: 9,
        points: 100,
        explanation: "El sonido necesita un medio material por el que propagarse.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"true-false">;
