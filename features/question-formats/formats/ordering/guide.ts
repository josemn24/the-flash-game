import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "ordering",
  slug: "ordenar",
  name: "Ordenar",
  shortName: "Ordenar",
  summary: "Colocar varios elementos en una secuencia correcta.",
  description: [
    "El jugador reorganiza elementos según una regla temporal, numérica, causal o procedimental.",
  ],
  recommendations: ["Cronologías", "Procesos por pasos", "Comparaciones de magnitud"],
  avoidWhen: [
    "Puede haber empates",
    "Existen varios órdenes válidos",
    "La lista es demasiado larga para la pantalla",
  ],
  rules: [
    "Todos los elementos deben colocarse",
    "La secuencia completa debe ser exacta",
    "Un orden incorrecto resta el 20 % hasta un mínimo de cero",
  ],
  authoringTips: [
    "Explicita el sentido del orden",
    "Usa entre tres y seis elementos",
    "Evita elementos indistinguibles",
  ],
  accessibility: [
    "Ofrece controles de subir y bajar además de arrastre",
    "Anuncia la posición de cada elemento",
    "Conserva un orden de foco lógico",
  ],
  mediaSupport: ["Elementos de texto"],
  timing: {
    recommendedSeconds: "14–24 s",
    notes: "El tiempo crece con el número de elementos y la necesidad de compararlos.",
  },
  scoring: SCORING_POLICIES.ordering,
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-ordering",
        type: "ordering",
        category: "Historia",
        tags: {
          domains: ["history", "technology"],
          topics: ["inventions"],
          cognitiveSkills: ["memory", "logical_reasoning"],
          formatSkills: ["ordering"],
        },
        question: "Ordena estos inventos del más antiguo al más reciente.",
        items: ["Internet", "Imprenta", "Teléfono", "Máquina de vapor"],
        correctOrder: ["Imprenta", "Máquina de vapor", "Teléfono", "Internet"],
        directionLabels: { start: "Más antiguo", end: "Más reciente" },
        timeLimit: 16,
        points: 140,
        explanation: "La imprenta precede a la máquina de vapor, el teléfono e Internet.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"ordering">;
