import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "mini-wordle",
  slug: "mini-wordle",
  name: "Mini-Wordle",
  shortName: "Wordle",
  summary: "Descubrir una palabra de cuatro o cinco letras en un número configurable de intentos.",
  description: [
    "El jugador escribe palabras válidas de la longitud configurada. Después de cada intento, cada casilla indica si la letra está en la posición correcta, aparece en otra posición o no pertenece a la solución.",
    "La ronda termina al resolver la palabra o consumir los intentos configurados. Un vocabulario español generado desde Hunspell se carga antes de iniciar el cronómetro y valida los intentos sin depender de servicios externos durante la partida.",
  ],
  recommendations: [
    "Desafíos especiales de lenguaje",
    "Vocabulario temático breve",
    "Rondas donde importen deducción y eficiencia",
  ],
  avoidWhen: [
    "La solución admite variantes ortográficas discutibles",
    "La lista de intentos válidos es demasiado limitada",
    "Se necesita una pregunta de respuesta inmediata",
  ],
  rules: [
    "Cada intento debe ser una palabra válida de la longitud configurada",
    "Las casillas distinguen posición correcta, letra desplazada y letra ausente",
    "Los intentos no válidos no consumen una oportunidad",
    "Resolver o consumir el último intento termina la ronda",
  ],
  authoringTips: [
    "Comprueba que la solución pertenezca al vocabulario general o declárala como adición editorial",
    "Evita soluciones regionales, abreviaturas y formas excesivamente raras",
    "Usa la pista opcional para orientar el tema sin revelar directamente la respuesta",
  ],
  accessibility: [
    "Acompaña cada color con un símbolo y una etiqueta textual",
    "Permite enviar con Enter y conserva un campo de texto nativo para teclados móviles",
    "Anuncia los errores de validación sin consumir intentos ni mover el foco",
  ],
  mediaSupport: ["Texto", "Pista temática opcional"],
  timing: {
    recommendedSeconds: "30–45 s",
    notes:
      "Es un desafío especial más largo que una pregunta convencional; ajusta el tiempo a la longitud y el número de intentos.",
  },
  scoring: SCORING_POLICIES["mini-wordle"],
  examples: [
    {
      title: "Palabra de astronomía",
      question: {
        id: "guide-mini-wordle-luna",
        type: "mini-wordle",
        category: "Lengua",
        tags: {
          domains: ["language_communication", "natural_sciences"],
          topics: ["vocabulary", "astronomy_planets"],
          cognitiveSkills: ["logical_reasoning", "memory"],
          formatSkills: ["deduction"],
        },
        question: "Descubre una palabra relacionada con la astronomía.",
        hint: "Puede verse en el cielo nocturno.",
        correctAnswer: "LUNA",
        timeLimit: 40,
        points: 150,
        explanation:
          "La palabra es «LUNA». Cada intento revela qué letras están colocadas, desplazadas o ausentes.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"mini-wordle">;
