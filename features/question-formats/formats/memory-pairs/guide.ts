import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "memory-pairs",
  slug: "memoria-de-parejas",
  name: "Memoria de parejas",
  shortName: "Parejas",
  summary: "Revelar losetas ocultas y encontrar parejas recordando su posición.",
  description: [
    "El jugador descubre dos losetas por intento. Si forman pareja, ambas quedan visibles; si no, se ocultan tras una pausa breve.",
    "Es una adaptación compacta del memory clásico para rondas rápidas, con progreso comparable por parejas encontradas, fallos y velocidad.",
  ],
  recommendations: [
    "Memoria visual pura",
    "Iconos, patrones o conceptos claramente distinguibles",
    "Desafíos especiales con tensión entre explorar y recordar",
  ],
  avoidWhen: [
    "Las losetas se distinguen solo por color",
    "Hay más de diez parejas o etiquetas largas",
    "Las imágenes contienen detalles difíciles de reconocer en móvil",
  ],
  rules: [
    "Tocar una loseta la revela",
    "La segunda loseta completa un intento",
    "Las parejas correctas quedan descubiertas",
    "Las parejas incorrectas se muestran brevemente y se ocultan",
    "Completar todas las parejas envía la respuesta automáticamente",
  ],
  authoringTips: [
    "Usa entre cuatro y diez parejas con símbolos o etiquetas inequívocas",
    "Mezcla las losetas sin dejar patrones evidentes por posición",
    "Mantén cada pareja con la misma etiqueta accesible en sus dos losetas",
  ],
  accessibility: [
    "Cada loseta debe tener etiqueta textual aunque muestre una imagen",
    "No dependas solo del color para distinguir parejas",
    "Los estados de pareja encontrada y fallo deben indicarse con texto o icono además de color",
    "La pausa de fallo debe permitir percibir ambas losetas antes de ocultarlas",
  ],
  mediaSupport: ["Losetas de texto", "Imagen o ilustración opcional por loseta"],
  timing: {
    recommendedSeconds: "15–25 s",
    notes: "Aumenta el límite si hay más de cuatro parejas o contenido visual complejo.",
  },
  scoring: SCORING_POLICIES["memory-pairs"],
  examples: [
    {
      title: "Iconos del clima",
      question: {
        id: "guide-memory-pairs",
        type: "memory-pairs",
        category: "Memoria",
        tags: {
          domains: ["mathematics", "natural_sciences"],
          topics: ["memory_training", "weather"],
          cognitiveSkills: ["memory"],
          formatSkills: ["comparison"],
        },
        question: "Encuentra las parejas de iconos del clima.",
        grid: { rows: 2, columns: 4 },
        mismatchRevealDuration: 0.65,
        tiles: [
          { id: "sol-1", pairId: "sol", label: "Sol", symbol: "☀️" },
          { id: "nube-1", pairId: "nube", label: "Nube", symbol: "☁️" },
          { id: "luna-1", pairId: "luna", label: "Luna", symbol: "🌙" },
          { id: "rayo-1", pairId: "rayo", label: "Rayo", symbol: "⚡" },
          { id: "luna-2", pairId: "luna", label: "Luna", symbol: "🌙" },
          { id: "sol-2", pairId: "sol", label: "Sol", symbol: "☀️" },
          { id: "rayo-2", pairId: "rayo", label: "Rayo", symbol: "⚡" },
          { id: "nube-2", pairId: "nube", label: "Nube", symbol: "☁️" },
        ],
        timeLimit: 18,
        points: 140,
        explanation:
          "El tablero contiene dos losetas de cada icono: Sol, Luna, Nube y Rayo. Cada pareja encontrada suma crédito y cada fallo reduce el resultado.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"memory-pairs">;
