import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "simon-sequence",
  slug: "simon-secuencias",
  name: "Simon: secuencias",
  shortName: "Simon",
  summary: "Observar una secuencia de símbolos iluminados y repetirla exactamente.",
  description: [
    "Los cuatro botones se iluminan en un orden fijo. Cuando termina la reproducción, el jugador debe repetir los mismos pasos sin apoyarse en la secuencia visible.",
    "La reproducción es igual para todos y no consume tiempo de respuesta; solo cuenta la rapidez con que se repite correctamente.",
  ],
  recommendations: [
    "Memoria de trabajo y reflejos",
    "Pausas visuales entre preguntas de conocimiento",
    "Rondas cortas de alta tensión",
  ],
  avoidWhen: [
    "Se necesita evaluar conocimiento temático",
    "La secuencia requiere más de seis pasos en una ronda breve",
    "El jugador no puede distinguir botones mediante etiqueta o símbolo",
  ],
  rules: [
    "Cuatro botones se iluminan uno a uno en una secuencia fija",
    "Los botones se habilitan al acabar la reproducción",
    "Una pulsación incorrecta termina la ronda inmediatamente",
    "Completar la secuencia exacta la envía automáticamente",
  ],
  authoringTips: [
    "Usa cuatro botones con etiquetas y símbolos claramente diferenciables",
    "Mantén la secuencia entre cuatro y seis pasos",
    "Repite algún botón solo si aporta una dificultad deliberada",
  ],
  accessibility: [
    "No dependas solo del color: cada botón muestra símbolo y etiqueta",
    "Mantén los cuatro botones disponibles por teclado con foco visible",
    "Anuncia la transición entre reproducción y repetición",
  ],
  mediaSupport: ["Cuatro botones visuales con símbolo y etiqueta"],
  timing: {
    recommendedSeconds: "4–6 pasos + 8–15 s de respuesta",
    notes:
      "La reproducción tiene ritmo fijo y queda fuera del temporizador y del bonus de velocidad.",
  },
  scoring: SCORING_POLICIES["simon-sequence"],
  examples: [
    {
      title: "Secuencia de símbolos",
      question: {
        id: "guide-simon-sequence",
        type: "simon-sequence",
        category: "Memoria",
        tags: {
          domains: ["mathematics"],
          topics: ["memory_training"],
          cognitiveSkills: ["memory"],
          formatSkills: ["recall"],
        },
        question: "Observa la secuencia y repítela cuando se activen los botones.",
        pads: [
          { id: "orbita", label: "Órbita" },
          { id: "cometa", label: "Cometa" },
          { id: "estrella", label: "Estrella" },
          { id: "luna", label: "Luna" },
        ],
        sequence: ["orbita", "estrella", "cometa", "luna", "estrella"],
        timeLimit: 12,
        points: 140,
        explanation:
          "La secuencia correcta es Órbita, Estrella, Cometa, Luna y Estrella. La reproducción no reduce el tiempo disponible para responder.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"simon-sequence">;
