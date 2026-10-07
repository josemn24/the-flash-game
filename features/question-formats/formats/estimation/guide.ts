import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "estimation",
  slug: "estimacion",
  name: "Estimación",
  shortName: "Estimación",
  summary: "Aproximarse a un valor numérico dentro de un rango conocido.",
  description: [
    "Premia el conocimiento aproximado y la intuición cuantitativa, incluso cuando no se conoce el dato exacto.",
  ],
  recommendations: [
    "Magnitudes sorprendentes",
    "Activar intuición numérica",
    "Preguntas con crédito gradual",
  ],
  avoidWhen: [
    "El valor cambia con frecuencia",
    "La unidad es ambigua",
    "No existe un rango razonable",
  ],
  rules: [
    "Se selecciona un único valor",
    "La cercanía determina el crédito",
    "Fuera de la tolerancia la puntuación llega a cero",
  ],
  authoringTips: [
    "Muestra siempre la unidad",
    "Define un paso cómodo",
    "Ajusta rango y tolerancia a la dificultad buscada",
  ],
  accessibility: [
    "Muestra el valor actual junto al control",
    "Permite usar teclado",
    "No comuniques la proximidad solo mediante color",
  ],
  mediaSupport: ["Texto", "Imagen o ilustración opcional"],
  timing: {
    recommendedSeconds: "12–20 s",
    notes: "Da tiempo para comprender la escala y ajustar el valor.",
  },
  scoring: SCORING_POLICIES.estimation,
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-estimation",
        type: "estimation",
        category: "Lugares",
        tags: {
          domains: ["geography", "culture"],
          topics: ["landmarks"],
          cognitiveSkills: ["quantitative_reasoning"],
          formatSkills: ["estimation"],
        },
        question: "¿Cuántos metros mide la Torre Eiffel?",
        correctAnswer: 330,
        min: 100,
        max: 500,
        step: 10,
        initialValue: 300,
        tolerance: 200,
        unit: "m",
        timeLimit: 15,
        points: 140,
        explanation: "La Torre Eiffel alcanza 330 metros contando su antena.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"estimation">;
