import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "logic-matrix",
  slug: "matrices-logicas",
  name: "Matrices lógicas",
  shortName: "Matriz",
  summary: "Completar la pieza que falta en un patrón visual de tres por tres.",
  description: [
    "La matriz muestra ocho piezas y una casilla vacía. El jugador analiza las relaciones entre filas y columnas para elegir la pieza que completa el patrón.",
    "La primera versión usa símbolos y etiquetas breves, de modo que la regla no depende únicamente del color.",
  ],
  recommendations: [
    "Razonamiento abstracto",
    "Patrones de rotación, alternancia o combinación",
    "Preguntas especiales de lógica",
  ],
  avoidWhen: [
    "La regla admite más de una continuación razonable",
    "Las piezas necesitan texto largo para distinguirse",
    "El patrón solo funciona por diferencias de color",
  ],
  rules: [
    "La matriz tiene nueve celdas y exactamente una está vacía",
    "Se elige una opción entre cuatro piezas",
    "Tocar una opción envía la respuesta inmediatamente",
    "Un fallo resta el 20 % hasta un mínimo de cero y agotar el tiempo no puntúa",
  ],
  authoringTips: [
    "Define una regla verificable por filas y columnas antes de crear las opciones",
    "Incluye distractores plausibles sin introducir otra regla válida",
    "Usa símbolos distinguibles y etiquetas cortas que describan cada pieza",
  ],
  accessibility: [
    "Etiqueta cada celda con fila, columna y nombre de pieza",
    "No uses el color como único rasgo diferenciador",
    "Mantén las cuatro opciones como botones amplios y accesibles por teclado",
  ],
  mediaSupport: ["Símbolos o texto breve", "Etiquetas accesibles por pieza"],
  timing: {
    recommendedSeconds: "12–20 s",
    notes: "Reserva más tiempo para reglas que combinen dos transformaciones simultáneas.",
  },
  scoring: SCORING_POLICIES["logic-matrix"],
  examples: [
    {
      title: "Ciclo de símbolos",
      question: {
        id: "guide-logic-matrix",
        type: "logic-matrix",
        category: "Lógica",
        tags: {
          domains: ["mathematics", "art_design"],
          topics: ["visual_patterns"],
          cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
          formatSkills: ["deduction"],
        },
        question: "¿Qué símbolo completa la matriz?",
        pieces: [
          { id: "circle", symbol: "●", label: "Círculo" },
          { id: "triangle", symbol: "▲", label: "Triángulo" },
          { id: "square", symbol: "■", label: "Cuadrado" },
          { id: "diamond", symbol: "◆", label: "Rombo" },
        ],
        cells: [
          "circle",
          "triangle",
          "square",
          "triangle",
          "square",
          "circle",
          "square",
          "circle",
          null,
        ],
        optionIds: ["circle", "triangle", "square", "diamond"],
        correctOptionId: "triangle",
        timeLimit: 15,
        points: 130,
        explanation:
          "Cada fila desplaza el ciclo círculo, triángulo y cuadrado una posición. La tercera fila debe terminar con un triángulo.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"logic-matrix">;
