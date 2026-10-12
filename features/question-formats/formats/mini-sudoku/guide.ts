import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "mini-sudoku",
  slug: "mini-sudoku",
  name: "Mini-sudoku 4 × 4",
  shortName: "Sudoku",
  summary: "Completar las casillas vacías de un sudoku 4 × 4 con números del 1 al 4.",
  description: [
    "La cuadrícula contiene pistas bloqueadas y tres o cuatro casillas vacías. El jugador puede seleccionar una casilla, escribir un número, reemplazarlo o borrarlo antes de confirmar.",
    "La solución se corrige al final: cada casilla correcta concede crédito parcial y no hay penalización por corregir un valor durante la ronda.",
  ],
  recommendations: [
    "Razonamiento numérico breve",
    "Pausas entre preguntas de conocimiento",
    "Retos táctiles que también funcionen con teclado",
  ],
  avoidWhen: [
    "Se necesita evaluar una cuadrícula de más de cuatro por cuatro",
    "La ronda requiere candidatos o validación de errores en vivo",
    "Hay más de cuatro huecos que completar",
  ],
  rules: [
    "Cada fila, columna y bloque de 2 × 2 contiene los números del 1 al 4 una vez",
    "Solo se pueden editar las casillas vacías",
    "La respuesta se confirma al completar todos los huecos",
    "Al agotarse el tiempo se evalúan los valores ya escritos",
  ],
  authoringTips: [
    "Comprueba que la solución cumpla filas, columnas y bloques antes de publicarla",
    "Deja tres o cuatro huecos y mantén las pistas idénticas a la solución",
    "Evita configuraciones que requieran ensayo y error para resolverse",
  ],
  accessibility: [
    "Cada casilla editable es un botón con fila, columna y valor accesibles",
    "El foco visible marca la casilla seleccionada",
    "El teclado numérico incluye botones etiquetados y una acción de borrar",
  ],
  mediaSupport: ["Cuadrícula numérica 4 × 4", "Teclado táctil de números 1–4"],
  timing: {
    recommendedSeconds: "18–30 s",
    notes:
      "El bonus de velocidad se aplica al tiempo hasta confirmar; corregir valores no tiene penalización.",
  },
  scoring: SCORING_POLICIES["mini-sudoku"],
  examples: [
    {
      title: "Cuadrícula de números",
      question: {
        id: "guide-mini-sudoku",
        type: "mini-sudoku",
        category: "Lógica",
        tags: {
          domains: ["mathematics"],
          topics: ["logic_puzzles"],
          cognitiveSkills: ["logical_reasoning", "problem_solving"],
          formatSkills: ["deduction"],
        },
        question: "Completa el mini-sudoku. Puedes corregir tus valores antes de confirmar.",
        grid: [1, null, 3, 4, 3, 4, null, 2, 2, 1, 4, null, null, 3, 2, 1],
        solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
        timeLimit: 24,
        points: 160,
        explanation:
          "Las cuatro casillas vacías son 2, 1, 3 y 4. Cada valor correcto suma una cuarta parte de los puntos, ajustada por la velocidad.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"mini-sudoku">;
