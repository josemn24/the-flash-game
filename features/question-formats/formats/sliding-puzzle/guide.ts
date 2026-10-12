import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "sliding-puzzle",
  slug: "rompecabezas-deslizante",
  name: "Rompecabezas deslizante",
  shortName: "Puzzle",
  summary: "Reconstruir el orden de ocho fichas moviéndolas hacia el único hueco disponible.",
  description: [
    "El tablero 3 × 3 contiene ocho fichas numeradas y un hueco. Solo se puede deslizar una ficha que esté junto al hueco, hasta llegar a la disposición objetivo.",
    "La primera versión usa números para mantener las reglas legibles y accesibles; cada configuración editorial se valida para asegurar que es resoluble.",
  ],
  recommendations: [
    "Razonamiento espacial y planificación breve",
    "Desafíos táctiles de lógica",
    "Rondas visuales que premian eficiencia temporal",
  ],
  avoidWhen: [
    "Se necesita una respuesta inmediata de conocimiento",
    "El tablero requiere más de 3 × 3 fichas",
    "Se pretende evaluar precisión de arrastre en lugar de resolución",
  ],
  rules: [
    "Solo se puede mover una ficha adyacente al hueco",
    "La partida termina automáticamente al reconstruir la solución",
    "El número de movimientos se muestra, pero no cambia la puntuación",
    "El timeout no puntúa si el tablero no se ha resuelto",
  ],
  authoringTips: [
    "Usa una solución con las fichas 1 a 8 en orden y el hueco al final",
    "Comprueba que el estado inicial tenga la misma paridad de inversiones que la solución",
    "Empieza con estados cercanos a la solución antes de aumentar la dificultad",
  ],
  accessibility: [
    "Cada ficha comunica número, fila, columna y si se puede mover",
    "Las fichas no movibles quedan deshabilitadas",
    "Las flechas desplazan la ficha correspondiente hacia el hueco y el foco permanece visible",
  ],
  mediaSupport: ["Fichas numéricas 1–8", "Cuadrícula espacial 3 × 3"],
  timing: {
    recommendedSeconds: "60 s",
    notes:
      "Los puntos se calculan por la rapidez de resolución; los movimientos se conservan solo para la revisión.",
  },
  scoring: SCORING_POLICIES["sliding-puzzle"],
  examples: [
    {
      title: "Dos deslizamientos",
      question: {
        id: "guide-sliding-puzzle",
        type: "sliding-puzzle",
        category: "Lógica",
        tags: {
          domains: ["mathematics"],
          topics: ["spatial_logic_puzzles"],
          cognitiveSkills: ["problem_solving"],
          formatSkills: ["planning"],
        },
        question: "Ordena las fichas del 1 al 8 dejando el hueco al final.",
        initialTiles: [1, 2, 3, 4, 5, 6, null, 7, 8],
        solution: [1, 2, 3, 4, 5, 6, 7, 8, null],
        timeLimit: 60,
        points: 150,
        explanation:
          "Desliza primero el 7 y después el 8 hacia el hueco para completar el orden. La solución exacta premia la velocidad.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"sliding-puzzle">;
