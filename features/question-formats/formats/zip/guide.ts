import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "zip",
  slug: "zip-una-linea",
  name: "Zip / Una línea",
  shortName: "Zip",
  summary: "Trazar una única línea que recorra los números en orden y cubra todas las celdas.",
  description: [
    "El jugador parte del número 1 y extiende un recorrido ortogonal continuo por toda la cuadrícula, pasando por cada número en orden.",
    "Cada celda se usa exactamente una vez. Se puede retroceder y rehacer cualquier tramo sin penalización antes de completar automáticamente el tablero.",
  ],
  recommendations: [
    "Razonamiento espacial y planificación global",
    "Rondas táctiles con reglas breves",
    "Desafíos especiales con una solución visual inequívoca",
  ],
  avoidWhen: [
    "La pantalla no permite celdas táctiles cómodas",
    "El tablero no tiene solución única verificada",
    "El tiempo disponible no permite corregir el recorrido",
  ],
  rules: [
    "Empieza en el número 1 y avanza a celdas ortogonales adyacentes",
    "Pasa por todos los números en orden y deja el último para el final",
    "Usa cada celda exactamente una vez",
    "Retroceder recorta el camino y no reduce la puntuación",
    "Cubrir el tablero completo envía la respuesta automáticamente",
  ],
  authoringTips: [
    "Usa una cuadrícula 5 × 5 y entre cuatro y seis checkpoints en la primera versión",
    "Genera primero la solución completa y coloca después los checkpoints",
    "Comprueba por software que existe exactamente una solución",
    "Prueba el tiempo y el trazado con el tamaño real de un teléfono",
  ],
  accessibility: [
    "Permite arrastre, selección discreta por toque y flechas del teclado",
    "Muestra los checkpoints con números y no solo mediante color",
    "Anuncia movimientos inválidos, checkpoints y progreso en una región en vivo",
    "Mantén foco visible y áreas táctiles del tamaño completo de cada celda",
  ],
  mediaSupport: ["Cuadrícula ortogonal 5 × 5", "Checkpoints numéricos"],
  timing: {
    recommendedSeconds: "30–40 s",
    notes:
      "El tiempo debe permitir planificar y corregir al menos un tramo sin convertir el puzzle en una ronda larga.",
  },
  scoring: SCORING_POLICIES.zip,
  examples: [
    {
      title: "Una línea relámpago",
      question: {
        id: "guide-zip",
        type: "zip",
        category: "Lógica espacial",
        tags: {
          domains: ["mathematics"],
          topics: ["spatial_logic_puzzles"],
          cognitiveSkills: ["problem_solving"],
          formatSkills: ["planning"],
        },
        question: "Une los números en orden y cubre todas las celdas con una sola línea.",
        grid: { rows: 5, columns: 5 },
        checkpoints: [
          { value: 1, cell: 0 },
          { value: 2, cell: 4 },
          { value: 3, cell: 5 },
          { value: 4, cell: 14 },
          { value: 5, cell: 15 },
          { value: 6, cell: 24 },
        ],
        solution: [
          0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22, 23, 24,
        ],
        timeLimit: 35,
        points: 150,
        explanation:
          "El camino serpentea por las cinco filas, visita los números del 1 al 6 en orden y utiliza las 25 celdas exactamente una vez.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"zip">;
