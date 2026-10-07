import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "flash-memory",
  slug: "memoria-relampago",
  name: "Memoria relámpago",
  shortName: "Memoria",
  summary: "Memorizar una composición breve y reconstruir las posiciones de sus fichas.",
  description: [
    "La composición aparece durante unos segundos y luego se oculta. El jugador debe colocar cada ficha en la posición que recuerda.",
    "La exposición es idéntica para todos; el cronómetro empieza cuando comienza la reconstrucción.",
  ],
  recommendations: [
    "Memoria espacial y reconocimiento visual",
    "Objetos, símbolos, banderas o conceptos breves",
    "Rondas de tensión con reglas inmediatas",
  ],
  avoidWhen: [
    "Las fichas se distinguen solo por detalles muy pequeños",
    "Hay más elementos de los que una cuadrícula móvil puede mostrar con claridad",
    "La respuesta depende de recordar texto extenso",
  ],
  rules: [
    "La composición se muestra durante una exposición fija",
    "El temporizador comienza al ocultarse la composición",
    "Se elige una ficha y después una posición; una ficha colocada puede retirarse",
    "Cada posición correcta aporta crédito parcial",
  ],
  authoringTips: [
    "Empieza con cuadrículas de dos por dos y cuatro fichas claramente diferenciables",
    "Usa posiciones completas y únicas, sin celdas vacías",
    "Mantén etiquetas breves y evita fichas visualmente demasiado parecidas",
  ],
  accessibility: [
    "Todas las fichas necesitan una etiqueta textual, incluso si incluyen una imagen",
    "Las posiciones y fichas son botones accesibles por teclado",
    "Anuncia el paso de memorización a reconstrucción sin depender solo de la animación",
  ],
  mediaSupport: ["Fichas de texto", "Imagen o ilustración opcional por ficha"],
  timing: {
    recommendedSeconds: "3 s de exposición + 10–15 s de reconstrucción",
    notes:
      "La exposición es fija y no cuenta para el límite de respuesta ni para el bonus de velocidad.",
  },
  scoring: SCORING_POLICIES["flash-memory"],
  examples: [
    {
      title: "Posiciones de planetas",
      question: {
        id: "guide-flash-memory",
        type: "flash-memory",
        category: "Espacio",
        tags: {
          domains: ["natural_sciences"],
          topics: ["astronomy_planets"],
          cognitiveSkills: ["memory"],
          formatSkills: ["recall"],
        },
        question: "Memoriza las posiciones de los planetas y reconstruye la cuadrícula.",
        revealDuration: 3,
        grid: { rows: 2, columns: 2 },
        items: [
          { id: "mercurio", label: "Mercurio", correctPosition: 0 },
          { id: "venus", label: "Venus", correctPosition: 1 },
          { id: "tierra", label: "Tierra", correctPosition: 2 },
          { id: "marte", label: "Marte", correctPosition: 3 },
        ],
        timeLimit: 12,
        points: 140,
        explanation:
          "La composición correcta sitúa Mercurio y Venus arriba, y Tierra y Marte abajo. Cada posición recordada suma una parte de los puntos.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"flash-memory">;
