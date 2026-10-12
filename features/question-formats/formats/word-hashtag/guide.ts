import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "word-hashtag",
  slug: "hashtag-de-palabras",
  name: "Hashtag de palabras",
  shortName: "Hashtag",
  summary:
    "Intercambiar letras en cuatro palabras cruzadas hasta completar un tablero con forma de hashtag.",
  description: [
    "El jugador reorganiza dieciséis fichas distribuidas en una cuadrícula con forma de #. Dos palabras horizontales y dos verticales comparten cuatro casillas.",
    "Cada intercambio actualiza simultáneamente todas las palabras afectadas. Las letras correctas quedan verdes y bloqueadas; las desplazadas permanecen amarillas y se pueden intercambiar hasta resolver o agotar los movimientos.",
  ],
  recommendations: [
    "Vocabulario y ortografía mediante deducción cruzada",
    "Rondas lingüísticas con planificación de movimientos",
    "Puzzles editoriales breves con solución inequívoca",
  ],
  avoidWhen: [
    "Las cuatro palabras admiten otra combinación razonable con las mismas letras",
    "El vocabulario contiene formas excesivamente raras o regionales",
    "Los cruces no permiten distinguir la solución sin depender de ensayo y error",
  ],
  rules: [
    "Toca dos fichas amarillas o arrastra una sobre otra para intercambiarlas",
    "Las fichas verdes están en su posición correcta y quedan bloqueadas",
    "Cada intercambio válido consume un movimiento",
    "Resolver las cuatro palabras o agotar los movimientos termina la ronda",
  ],
  authoringTips: [
    "Usa cuatro palabras españolas comunes de cinco letras con cruces compatibles",
    "Comprueba que el conjunto completo tenga una interpretación inequívoca",
    "Ajusta el límite de movimientos por encima del mínimo calculado para permitir algún error",
  ],
  accessibility: [
    "Acompaña verde y amarillo con los símbolos ✓ y ↔ y etiquetas textuales",
    "Mantén todas las fichas como botones nativos utilizables con teclado",
    "Ofrece selección por dos toques como alternativa al arrastre",
  ],
  mediaSupport: ["Texto", "Cuatro palabras editoriales de cinco letras"],
  timing: {
    recommendedSeconds: "15–30 s",
    notes:
      "Aumenta el límite si el estado inicial exige varios intercambios o usa vocabulario menos frecuente.",
  },
  scoring: SCORING_POLICIES["word-hashtag"],
  examples: [
    {
      title: "Cuatro palabras cruzadas",
      question: {
        id: "guide-word-hashtag",
        type: "word-hashtag",
        category: "Lengua",
        tags: {
          domains: ["language_communication"],
          topics: ["vocabulary", "spelling"],
          cognitiveSkills: ["logical_reasoning", "problem_solving"],
          formatSkills: ["deduction", "ordering"],
        },
        question: "Intercambia las letras amarillas para completar las cuatro palabras.",
        grid: { rows: 5, columns: 5 },
        words: {
          top: "YOGUI",
          bottom: "REUMA",
          left: "PONER",
          right: "QUEMA",
        },
        initialLetters: [
          null,
          "G",
          null,
          "Q",
          null,
          "E",
          "O",
          "P",
          "U",
          "I",
          null,
          "N",
          null,
          "Y",
          null,
          "R",
          "A",
          "U",
          "M",
          "E",
          null,
          "R",
          null,
          "A",
          null,
        ],
        maxMoves: 3,
        timeLimit: 20,
        points: 150,
        explanation:
          "Tres intercambios completan el tablero: P con G, Y con la E central derecha y A con la E del extremo derecho. El resultado forma YOGUI, REUMA, PONER y QUEMA.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"word-hashtag">;
