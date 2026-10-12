import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "connect-pairs",
  slug: "conectar-parejas",
  name: "Conectar parejas",
  shortName: "Conectar",
  summary: "Unir pares iguales en una cuadrícula sin cruzar rutas y cubriendo el tablero.",
  description: [
    "El jugador traza caminos ortogonales entre extremos con el mismo símbolo. Cada casilla pertenece como máximo a una ruta.",
    "La v1 usa tableros 5 × 5 con cobertura completa: resolver implica conectar todas las parejas y ocupar todas las casillas.",
  ],
  recommendations: [
    "Puzzles visuales rápidos",
    "Desafíos especiales de lógica espacial",
    "Rondas táctiles con progreso parcial legible",
  ],
  avoidWhen: [
    "La pantalla no permite celdas táctiles cómodas",
    "El reto no tiene solución única o curada",
    "Se quiere evaluar conocimiento verbal en lugar de planificación espacial",
  ],
  rules: [
    "Selecciona un extremo y extiende su ruta por celdas ortogonales",
    "Las rutas no pueden cruzarse ni compartir casillas",
    "Tocar una ruta propia permite recortarla y rehacerla",
    "Completar todas las parejas y cubrir el tablero envía la respuesta automáticamente",
  ],
  authoringTips: [
    "Usa entre tres y cinco parejas en tablero 5 × 5",
    "Comprueba que la solución editorial cubre las 25 casillas sin cruces",
    "Asigna símbolos o etiquetas además de color para cada pareja",
  ],
  accessibility: [
    "No dependas solo del color: cada pareja necesita símbolo visible y nombre accesible",
    "Mantén foco visible en tablero, celdas y controles",
    "Permite construir rutas con teclado mediante flechas",
  ],
  mediaSupport: ["Cuadrícula", "Símbolos y color editorial por pareja"],
  timing: {
    recommendedSeconds: "30–35 s",
    notes: "Ajusta el tiempo al número de parejas y a la necesidad de cobertura completa.",
  },
  scoring: SCORING_POLICIES["connect-pairs"],
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-connect-pairs",
        type: "connect-pairs",
        category: "Lógica espacial",
        tags: {
          domains: ["mathematics"],
          topics: ["spatial_logic_puzzles"],
          cognitiveSkills: ["problem_solving"],
          formatSkills: ["planning"],
        },
        question: "Conecta cada pareja de símbolos y cubre toda la cuadrícula.",
        grid: { rows: 5, columns: 5 },
        pairs: [
          { id: "a", label: "Pareja A", symbol: "A", endpoints: [0, 4], color: "#35e8ff" },
          { id: "b", label: "Pareja B", symbol: "B", endpoints: [5, 24], color: "#d7ff18" },
          { id: "c", label: "Pareja C", symbol: "C", endpoints: [6, 19], color: "#ff6d73" },
        ],
        solutionPaths: {
          a: [0, 1, 2, 3, 4],
          b: [5, 10, 15, 20, 21, 22, 23, 24],
          c: [6, 7, 8, 9, 14, 13, 12, 11, 16, 17, 18, 19],
        },
        requireFullCoverage: true,
        timeLimit: 35,
        points: 150,
        explanation:
          "Cada símbolo se une con su pareja mediante una ruta ortogonal. La solución cubre las 25 casillas sin cruces ni solapamientos.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"connect-pairs">;
