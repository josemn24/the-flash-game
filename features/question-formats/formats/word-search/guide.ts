import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "word-search",
  slug: "sopa-de-letras",
  name: "Sopa de letras",
  shortName: "Sopa",
  summary:
    "Encontrar palabras ocultas en una cuadrícula, en horizontal, vertical o diagonal y en cualquier sentido.",
  description: [
    "El jugador busca entre dos y ocho palabras editoriales dentro de una cuadrícula compacta. Cada objetivo ocupa un segmento recto horizontal, vertical o diagonal que puede leerse en cualquiera de los dos sentidos.",
    "Las palabras encontradas quedan señaladas y aportan crédito parcial. La ronda termina automáticamente al completar la lista o conserva el progreso cuando se agota el tiempo.",
  ],
  recommendations: [
    "Vocabulario y ortografía de una temática concreta",
    "Reconocimiento visual con reglas conocidas",
    "Rondas lingüísticas breves o desafíos especiales",
  ],
  avoidWhen: [
    "La cuadrícula necesita más de diez filas o columnas para alojar el contenido",
    "Una palabra aparece accidentalmente en varias posiciones",
    "Las variantes ortográficas o flexiones hacen ambigua la lista de objetivos",
  ],
  rules: [
    "Busca todas las palabras visibles en la lista",
    "Selecciona la primera y la última letra mediante arrastre o dos toques",
    "Las palabras pueden estar en ocho direcciones y compartir letras",
    "Cada palabra encontrada aporta crédito; las selecciones fallidas no restan puntos",
  ],
  authoringTips: [
    "Usa cuadrículas de 6 × 6 a 10 × 10 y entre dos y ocho palabras relacionadas",
    "Declara la posición exacta de cada objetivo y valida que no tenga apariciones accidentales",
    "Combina direcciones sin concentrar todos los inicios en el mismo borde",
    "Conserva tildes y Ñ en el tablero cuando formen parte de la grafía del objetivo",
  ],
  accessibility: [
    "Permite arrastre, selección por dos toques y navegación con flechas",
    "Anuncia fila, columna, letra, dirección y progreso mediante etiquetas textuales",
    "Distingue palabras encontradas y pendientes con iconos, patrones y texto además de color",
    "Mantén una única celda en el orden de tabulación y foco visible dentro de la cuadrícula",
  ],
  mediaSupport: ["Cuadrícula de letras", "Lista textual de palabras objetivo"],
  timing: {
    recommendedSeconds: "30–60 s",
    notes:
      "Ajusta el tiempo según el tamaño de la cuadrícula, la longitud de las palabras y la cantidad de diagonales o sentidos inversos.",
  },
  scoring: SCORING_POLICIES["word-search"],
  examples: [
    {
      title: "Fauna oculta",
      question: {
        id: "guide-word-search-fauna",
        type: "word-search",
        category: "Lengua y naturaleza",
        tags: {
          domains: ["language_communication", "natural_sciences"],
          topics: ["vocabulary", "biology_taxonomy"],
          cognitiveSkills: ["pattern_recognition"],
          formatSkills: ["comparison"],
        },
        question: "Encuentra los cinco animales ocultos en la cuadrícula.",
        grid: { rows: 8, columns: 8 },
        letters: Array.from("TIGREQLCCRUOVXSEOPVNECIBVHACGHQRPJNNRKKADIDTDMIULMIGBAFACEHALAOK"),
        targets: [
          { id: "tigre", word: "TIGRE", startCell: 0, endCell: 4 },
          { id: "cebra", word: "CEBRA", startCell: 7, endCell: 39 },
          { id: "panda", word: "PANDA", startCell: 17, endCell: 53 },
          { id: "koala", word: "KOALA", startCell: 63, endCell: 59 },
          { id: "lince", word: "LINCE", startCell: 48, endCell: 20 },
        ],
        timeLimit: 45,
        points: 150,
        explanation:
          "TIGRE aparece en horizontal, CEBRA en vertical, PANDA y LINCE en diagonal y KOALA de derecha a izquierda.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"word-search">;
