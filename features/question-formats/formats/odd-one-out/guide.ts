import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "odd-one-out",
  slug: "encontrar-el-intruso",
  name: "Encontrar el intruso",
  shortName: "Intruso",
  summary: "Detectar qué elemento rompe la relación compartida por el resto.",
  description: [
    "El jugador compara entre tres y seis elementos y toca directamente el único que no comparte la regla del conjunto.",
    "Puede trabajar con palabras, números, imágenes o ilustraciones, siempre que la relación y la excepción sean inequívocas.",
  ],
  recommendations: [
    "Categorías y familias reconocibles",
    "Patrones numéricos o lingüísticos breves",
    "Rondas visuales de alta velocidad",
  ],
  avoidWhen: [
    "Más de un elemento podría considerarse diferente",
    "La relación depende de conocimiento demasiado especializado",
    "Las imágenes contienen detalles difíciles de percibir en móvil",
  ],
  rules: [
    "Hay un único intruso entre tres y seis elementos",
    "La respuesta se envía inmediatamente al tocar una tarjeta",
    "Un fallo resta el 20 % hasta un mínimo de cero y agotar el tiempo no puntúa",
  ],
  authoringTips: [
    "Define primero la relación exacta que comparten los elementos válidos",
    "Comprueba que el intruso no encaje mediante otra interpretación razonable",
    "Mantén etiquetas e imágenes homogéneas para no revelar la solución por su forma",
  ],
  accessibility: [
    "Proporciona una etiqueta textual útil para cada elemento",
    "Incluye texto alternativo descriptivo en todas las imágenes",
    "Mantén tarjetas amplias, foco visible y un orden de teclado lógico",
  ],
  mediaSupport: ["Elementos de texto", "Imagen o ilustración opcional por elemento"],
  timing: {
    recommendedSeconds: "5–10 s",
    notes: "Añade tiempo cuando la relación exija inspeccionar imágenes o comparar datos.",
  },
  scoring: SCORING_POLICIES["odd-one-out"],
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-odd-one-out",
        type: "odd-one-out",
        category: "Lengua",
        tags: {
          domains: ["language_communication", "natural_sciences"],
          topics: ["word_groups", "astronomy_planets"],
          cognitiveSkills: ["comprehension", "pattern_recognition"],
          formatSkills: ["comparison", "classification"],
        },
        question: "¿Qué palabra no pertenece al mismo grupo que las demás?",
        items: [
          { id: "mercurio", label: "Mercurio" },
          { id: "venus", label: "Venus" },
          { id: "luna", label: "Luna" },
          { id: "marte", label: "Marte" },
        ],
        correctAnswer: "luna",
        timeLimit: 8,
        points: 100,
        explanation: "Mercurio, Venus y Marte son planetas; la Luna es un satélite natural.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"odd-one-out">;
