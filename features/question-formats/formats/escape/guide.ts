import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "escape",
  slug: "escape",
  name: "Escape",
  shortName: "Escape",
  summary: "Liberar un bloque objetivo desplazando obstáculos sobre sus ejes.",
  description: [
    "El tablero 6 × 6 contiene bloques horizontales y verticales que solo pueden desplazarse sobre su propio eje. El objetivo es despejar la salida lateral del bloque amarillo.",
    "La primera versión usa una configuración editorial breve para validar el arrastre, el control por teclado y la lectura competitiva por tiempo.",
  ],
  recommendations: [
    "Desafíos especiales de lógica espacial",
    "Planificación de dependencias en pocos movimientos",
    "Rondas táctiles con una meta visual inmediata",
  ],
  avoidWhen: [
    "La pantalla no permite un tablero 6 × 6 con objetivos táctiles cómodos",
    "La configuración no se ha validado movimiento a movimiento",
    "Se necesita una pregunta de conocimiento con respuesta inmediata",
  ],
  rules: [
    "Cada bloque se mueve únicamente sobre su eje y nunca puede girarse",
    "Un desplazamiento de varias casillas cuenta como un movimiento",
    "El bloque amarillo escapa automáticamente al alcanzar la salida derecha",
    "Los movimientos no cambian la puntuación y un timeout no concede puntos",
  ],
  authoringTips: [
    "Mantén la salida a la derecha y el objetivo horizontal en su misma fila",
    "Comprueba límites, solapamientos y cada paso de la solución de referencia",
    "Reserva configuraciones largas para desafíos especiales y comunica el óptimo como dato editorial",
  ],
  accessibility: [
    "Diferencia los bloques mediante símbolos y patrones además del color",
    "Permite seleccionar cada bloque y recorrer sus destinos legales con las flechas",
    "Ofrece foco visible y anuncios accesibles de cada movimiento",
  ],
  mediaSupport: ["Bloques geométricos", "Cuadrícula espacial 6 × 6"],
  timing: {
    recommendedSeconds: "35–50 s",
    notes:
      "La puntuación depende de la velocidad de resolución; movimientos, deshacer y reiniciar no aplican penalización.",
  },
  scoring: SCORING_POLICIES.escape,
  examples: [
    {
      title: "Escape de bloques",
      question: {
        id: "guide-escape",
        type: "escape",
        category: "Lógica",
        tags: {
          domains: ["mathematics"],
          topics: ["spatial_logic_puzzles"],
          cognitiveSkills: ["problem_solving"],
          formatSkills: ["planning"],
        },
        question: "Mueve los bloques para liberar la pieza amarilla por la salida.",
        grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
        initialBlocks: [
          {
            id: "target",
            kind: "target",
            orientation: "horizontal",
            row: 2,
            column: 0,
            length: 2,
          },
          {
            id: "a",
            kind: "obstacle",
            orientation: "vertical",
            row: 1,
            column: 2,
            length: 2,
          },
          {
            id: "b",
            kind: "obstacle",
            orientation: "vertical",
            row: 0,
            column: 4,
            length: 3,
          },
          {
            id: "c",
            kind: "obstacle",
            orientation: "horizontal",
            row: 0,
            column: 1,
            length: 2,
          },
          {
            id: "d",
            kind: "obstacle",
            orientation: "horizontal",
            row: 4,
            column: 1,
            length: 2,
          },
        ],
        referenceSolution: [
          { blockId: "c", from: 1, to: 0 },
          { blockId: "a", from: 1, to: 0 },
          { blockId: "b", from: 0, to: 3 },
          { blockId: "target", from: 0, to: 4 },
        ],
        optimalMoves: 4,
        timeLimit: 45,
        points: 150,
        explanation:
          "El bloque A necesita espacio arriba o abajo; después, al apartar también el bloque B, la pieza amarilla puede recorrer toda la fila hasta la salida.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"escape">;
