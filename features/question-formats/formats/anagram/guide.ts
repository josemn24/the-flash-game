import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "anagram",
  slug: "anagramas",
  name: "Anagramas",
  shortName: "Anagramas",
  summary: "Ordenar fichas de letras para formar una palabra antes de que se agote el tiempo.",
  description: [
    "El jugador construye una única palabra tocando las fichas de letras en el orden correcto, sin escribir con el teclado.",
    "Cada ficha solo se puede usar una vez; las letras repetidas conservan fichas independientes para que la palabra se pueda reconstruir con precisión.",
  ],
  recommendations: [
    "Vocabulario y ortografía",
    "Conceptos temáticos breves",
    "Rondas lingüísticas de alta velocidad",
  ],
  avoidWhen: [
    "La solución tiene menos de tres o más de diez letras",
    "Varias palabras válidas usan exactamente las mismas letras",
    "La pista depende de un juego de palabras regional o ambiguo",
  ],
  rules: [
    "Se construye una única palabra con todas las fichas",
    "Cada ficha se usa una sola vez",
    "Se puede quitar la última ficha o reiniciar antes de enviar",
    "Un envío incorrecto termina la ronda",
  ],
  authoringTips: [
    "Usa una pista suficiente para descartar anagramas alternativos",
    "Mezcla el orden inicial de las fichas; no muestres la solución ya ordenada",
    "Incluye letras repetidas solo cuando la pista haga inequívoca la respuesta",
  ],
  accessibility: [
    "Cada letra es un botón nativo con etiqueta explícita",
    "La palabra construida anuncia el progreso y el número de fichas usadas",
    "No dependas de color, arrastre o precisión motriz para ordenar las fichas",
  ],
  mediaSupport: ["Texto", "Pista textual opcional"],
  timing: {
    recommendedSeconds: "10–20 s",
    notes: "Aumenta el tiempo solo para palabras largas o pistas de lectura más exigente.",
  },
  scoring: SCORING_POLICIES.anagram,
  examples: [
    {
      title: "Palabra con letras distintas",
      question: {
        id: "guide-anagram-mesa",
        type: "anagram",
        category: "Lengua",
        tags: {
          domains: ["language_communication"],
          topics: ["vocabulary", "spelling"],
          cognitiveSkills: ["problem_solving"],
          formatSkills: ["ordering"],
        },
        question: "Forma la palabra que nombra un mueble para comer o trabajar.",
        hint: "Suele tener patas y una superficie plana.",
        tiles: [
          { id: "s", value: "S" },
          { id: "a", value: "A" },
          { id: "m", value: "M" },
          { id: "e", value: "E" },
        ],
        correctAnswer: "MESA",
        timeLimit: 12,
        points: 100,
        explanation: "Las cuatro fichas se ordenan como M-E-S-A para formar «mesa».",
      },
    },
    {
      title: "Palabra con letras repetidas",
      question: {
        id: "guide-anagram-anana",
        type: "anagram",
        category: "Lengua",
        tags: {
          domains: ["language_communication", "culture"],
          topics: ["vocabulary", "spelling"],
          cognitiveSkills: ["problem_solving"],
          formatSkills: ["ordering"],
        },
        question: "Forma el nombre de una fruta tropical.",
        hint: "Tiene tres letras A y dos letras N.",
        tiles: [
          { id: "n-1", value: "N" },
          { id: "a-1", value: "A" },
          { id: "a-2", value: "A" },
          { id: "n-2", value: "N" },
          { id: "a-3", value: "A" },
        ],
        correctAnswer: "ANANA",
        timeLimit: 15,
        points: 120,
        explanation: "La palabra «anana» alterna las fichas A y N: A-N-A-N-A.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"anagram">;
