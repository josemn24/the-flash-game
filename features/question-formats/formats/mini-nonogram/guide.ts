import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "mini-nonogram",
  slug: "mini-nonograma",
  name: "Mini-nonograma 5 × 5",
  shortName: "Nonograma",
  summary: "Resolver una cuadrícula de pistas marcando las celdas que forman el patrón oculto.",
  description: [
    "Las pistas de cada fila y columna indican los grupos consecutivos de celdas rellenas. El jugador puede seleccionar una celda, rellenarla o marcarla vacía y confirmar en cualquier momento.",
    "Solo los rellenos aportan puntuación: los correctos suman crédito y los erróneos lo reducen, sin que el resultado final pueda ser negativo.",
  ],
  recommendations: [
    "Razonamiento visual y deducción",
    "Desafíos especiales de lógica",
    "Pausas táctiles entre preguntas de conocimiento",
  ],
  avoidWhen: [
    "Se necesita una ronda de menos de treinta segundos",
    "El diseño depende de colores en lugar de pistas numéricas",
    "Se requieren cuadrículas mayores de 5 × 5",
  ],
  rules: [
    "Cada número indica la longitud de un grupo consecutivo de celdas rellenas",
    "Dos grupos de una misma línea están separados por al menos una celda vacía",
    "Rellenar y vaciar una celda son acciones reversibles antes de confirmar",
    "El timeout evalúa los rellenos marcados hasta ese momento",
  ],
  authoringTips: [
    "Deriva las pistas directamente de una solución booleana 5 × 5 válida",
    "Usa patrones reconocibles y que no requieran ensayo y error",
    "Comprueba la solución con filas y columnas antes de publicar el contenido",
  ],
  accessibility: [
    "Etiqueta cada celda con su fila, columna y estado",
    "Muestra las pistas como números, no solo como rasgos visuales",
    "Incluye controles de rellenar y marcar vacía utilizables con teclado y foco visible",
  ],
  mediaSupport: ["Cuadrícula numérica 5 × 5", "Pistas de filas y columnas"],
  timing: {
    recommendedSeconds: "90 s",
    notes:
      "El bonus de velocidad se aplica al tiempo hasta confirmar y el borrador se conserva al agotarse el tiempo.",
  },
  scoring: SCORING_POLICIES["mini-nonogram"],
  examples: [
    {
      title: "Patrón en cruz",
      question: {
        id: "guide-mini-nonogram",
        type: "mini-nonogram",
        category: "Lógica",
        tags: {
          domains: ["mathematics"],
          topics: ["visual_patterns"],
          cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
          formatSkills: ["deduction"],
        },
        question: "Usa las pistas de filas y columnas para completar el patrón.",
        solution: [
          false,
          true,
          true,
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          false,
          true,
          false,
          true,
          false,
          true,
          true,
          true,
          false,
        ],
        rowClues: [[3], [1, 1, 1], [5], [1, 1, 1], [3]],
        columnClues: [[3], [1, 1, 1], [5], [1, 1, 1], [3]],
        timeLimit: 90,
        points: 180,
        explanation:
          "Las pistas forman una cruz simétrica. Los rellenos correctos suman crédito y los erróneos lo reducen hasta un mínimo de cero.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"mini-nonogram">;
