import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "progressive-clues",
  slug: "adivinanzas-por-pistas",
  name: "Adivinanzas por pistas",
  shortName: "Pistas",
  summary: "Identificar una respuesta revelando solo las pistas necesarias para conservar puntos.",
  description: [
    "El jugador recibe una primera pista y decide entre responder o revelar información adicional. Cada nueva pista facilita la adivinanza, pero reduce el máximo de puntos disponible.",
    "La respuesta es abierta y solo puede enviarse una vez, de modo que la mecánica combina conocimiento, autoconfianza y gestión del riesgo.",
  ],
  recommendations: [
    "Personajes, lugares, obras y conceptos reconocibles",
    "Rondas de conocimiento con dificultad decreciente",
    "Preguntas donde cada pista acota claramente la solución",
  ],
  avoidWhen: [
    "Las primeras pistas no aportan información útil",
    "Varias respuestas encajan razonablemente con todas las pistas",
    "La solución necesita una explicación extensa o muy especializada",
  ],
  rules: [
    "La primera pista está visible y no consume puntos",
    "Cada pista adicional resta una cantidad fija del máximo disponible hasta un mínimo de cero",
    "Se puede responder en cualquier momento, pero solo hay un intento",
    "Una respuesta incorrecta o agotar el tiempo puntúa cero",
  ],
  authoringTips: [
    "Ordena las pistas desde la más difícil hasta la más reveladora",
    "Haz que cada pista reduzca de forma apreciable el espacio de respuestas",
    "Incluye variantes habituales del nombre entre las respuestas aceptadas",
    "Comprueba que revelar todas las pistas todavía deje puntos disponibles",
  ],
  accessibility: [
    "Anuncia cada nueva pista y el máximo restante mediante una región en vivo",
    "Mantén las pistas anteriores visibles y numeradas",
    "Permite enviar la respuesta con teclado y conserva un foco visible",
  ],
  mediaSupport: ["Pistas de texto"],
  timing: {
    recommendedSeconds: "18–30 s",
    notes: "El límite debe permitir leer todas las pistas y escribir una respuesta breve en móvil.",
  },
  scoring: SCORING_POLICIES["progressive-clues"],
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-progressive-clues",
        type: "progressive-clues",
        category: "Ciencia",
        tags: {
          domains: ["natural_sciences", "history"],
          topics: ["scientists"],
          cognitiveSkills: ["memory", "comprehension"],
          formatSkills: ["deduction", "recall"],
        },
        question: "¿Qué científica soy?",
        clues: [
          "Nací en Varsovia durante la segunda mitad del siglo XIX.",
          "Desarrollé la mayor parte de mi carrera científica en Francia.",
          "Investigué la radiactividad y participé en el descubrimiento del polonio y el radio.",
          "Fui la primera persona en recibir dos premios Nobel en disciplinas científicas distintas.",
        ],
        cluePenalty: 30,
        correctAnswer: "Marie Curie",
        acceptedAnswers: [
          "Marie Curie",
          "Curie",
          "Maria Sklodowska-Curie",
          "Maria Skłodowska-Curie",
        ],
        timeLimit: 25,
        points: 160,
        explanation:
          "Marie Curie nació en Varsovia, desarrolló su carrera en Francia y recibió los premios Nobel de Física y Química por sus investigaciones sobre la radiactividad.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"progressive-clues">;
