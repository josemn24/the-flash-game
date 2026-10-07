import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "matching",
  slug: "emparejar-conceptos",
  name: "Emparejar conceptos",
  shortName: "Emparejar",
  summary: "Relacionar cada elemento de una columna con su pareja correcta.",
  description: [
    "El jugador selecciona una tarjeta de cada columna para probar una relación. Las parejas correctas quedan resueltas y las incorrectas se rechazan para poder reintentarlas.",
    "Admite relaciones de conocimiento, significado o reconocimiento visual mediante etiquetas e imágenes opcionales.",
  ],
  recommendations: ["Países y capitales", "Autores y obras", "Conceptos, definiciones e imágenes"],
  avoidWhen: [
    "Un elemento puede tener varias parejas defendibles",
    "Las etiquetas necesitan explicaciones muy extensas",
    "Hay más de seis relaciones en una misma ronda",
  ],
  rules: [
    "Se selecciona una tarjeta de cada columna",
    "Las parejas correctas quedan bloqueadas y las incorrectas se liberan",
    "Cada pareja incorrecta resta el 10 % de los puntos base hasta un mínimo de cero",
    "Completar todas las parejas envía la respuesta automáticamente",
  ],
  authoringTips: [
    "Usa entre tres y seis parejas inequívocas",
    "Desordena explícitamente la columna derecha",
    "Mantén longitud y presentación homogéneas para no dar pistas",
  ],
  accessibility: [
    "Mantén una etiqueta accesible aunque la tarjeta muestre solo la imagen",
    "Anuncia cada acierto y error mediante una región en vivo",
    "Conserva un orden de teclado lógico entre ambas columnas",
  ],
  mediaSupport: ["Elementos de texto", "Imagen o ilustración opcional por tarjeta"],
  timing: {
    recommendedSeconds: "15–25 s",
    notes: "Ajusta el tiempo al número de parejas y a la carga visual de las tarjetas.",
  },
  scoring: SCORING_POLICIES.matching,
  examples: [
    {
      title: "Ejemplo",
      question: {
        id: "guide-matching",
        type: "matching",
        category: "Geografía",
        tags: {
          domains: ["geography", "culture"],
          topics: ["countries_flags"],
          cognitiveSkills: ["memory"],
          formatSkills: ["comparison"],
        },
        question: "Empareja cada país con su bandera.",
        leftItems: [
          { id: "japon", label: "Japón", correctMatchId: "bandera-japon" },
          { id: "italia", label: "Italia", correctMatchId: "bandera-italia" },
          { id: "francia", label: "Francia", correctMatchId: "bandera-francia" },
        ],
        rightItems: [
          {
            id: "bandera-italia",
            label: "Bandera de Italia",
            media: { type: "illustration", id: "italy-flag", alt: "Bandera de Italia" },
          },
          {
            id: "bandera-francia",
            label: "Bandera de Francia",
            media: { type: "illustration", id: "france-flag", alt: "Bandera de Francia" },
          },
          {
            id: "bandera-japon",
            label: "Bandera de Japón",
            media: { type: "illustration", id: "japan-flag", alt: "Bandera de Japón" },
          },
        ],
        timeLimit: 20,
        points: 150,
        explanation: "Japón, Italia y Francia tienen banderas nacionales claramente diferenciadas.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"matching">;
