import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "queens",
  slug: "queens",
  name: "Queens",
  shortName: "Queens",
  summary:
    "Colocar N coronas en tableros cuadrados de 4 × 4 a 8 × 8 sin repetir fila, columna o región y sin que dos coronas se toquen.",
  description: [
    "El tablero se divide en N regiones. El jugador coloca exactamente una corona en cada fila, columna y región mientras descarta candidatos con marcas X opcionales.",
    "Las colocaciones conflictivas se permiten y se señalan al instante. Completar N coronas, incluidas las pistas fijas, valida el tablero automáticamente; editar coronas o marcas no tiene coste. Durante la validación el tablero queda bloqueado.",
    "En Pirámide competitivo hay tres oportunidades: los dos primeros tableros incorrectos permiten continuar y el tercer fallo termina el ascenso. Acertar en la tercera oportunidad supera el nivel. El contador muestra los intentos restantes confirmados por el servidor.",
  ],
  recommendations: [
    "Deducción espacial compacta",
    "Desafíos táctiles de lógica",
    "Rondas donde importan precisión y velocidad",
  ],
  avoidWhen: [
    "Las regiones no pueden distinguirse sin depender del color",
    "El tablero no tiene una solución única verificada",
    "El tiempo disponible no permite anotar y corregir candidatos",
  ],
  rules: [
    "Coloca exactamente una corona en cada fila y columna",
    "Coloca exactamente una corona en cada región",
    "Dos coronas no pueden tocarse, tampoco en diagonal",
    "Usa marcas X para descartar celdas; no se colocan automáticamente",
    "Completar N coronas valida el tablero automáticamente, incluidas las pistas fijas",
    "En Pirámide competitivo, tres validaciones incorrectas terminan la partida",
  ],
  authoringTips: [
    "Usa una cuadrícula cuadrada de 4 × 4 a 8 × 8 con N regiones ortogonalmente conectadas",
    "Comprueba por software que la solución sea legal y única",
    "Empieza con tableros curados y mide tiempos reales antes de aumentar el tamaño",
    "Evita regiones o soluciones que conviertan el reto en ensayo y error",
  ],
  accessibility: [
    "Distingue regiones mediante color, patrón y bordes de alto contraste",
    "Etiqueta cada celda con fila, columna, región, estado y conflictos",
    "Ofrece herramientas explícitas, foco móvil y control completo por teclado",
    "Anuncia cada colocación y conflicto sin mover el foco",
  ],
  mediaSupport: ["Cuadrícula de regiones N × N (4 × 4 a 8 × 8)", "Coronas SVG y marcas X"],
  timing: {
    recommendedSeconds: "45–75 s",
    notes:
      "Las reglas se leen antes de iniciar. Solo resolver puntúa; cada validación completa incorrecta resta un 5 % de los puntos base hasta un mínimo de cero. En Pirámide competitivo el tercer fallo cierra el nivel con cero puntos para Queens y conserva los puntos de niveles anteriores. Flash, Supervivencia, Narrative y práctica mantienen sus reglas.",
  },
  scoring: SCORING_POLICIES.queens,
  examples: [
    {
      title: "Cinco coronas",
      question: {
        id: "guide-queens",
        type: "queens",
        category: "Lógica espacial",
        tags: {
          domains: ["mathematics"],
          topics: ["spatial_logic_puzzles"],
          cognitiveSkills: ["logical_reasoning", "problem_solving"],
          formatSkills: ["deduction", "planning"],
        },
        question: "Coloca cinco coronas sin repetir fila, columna o región.",
        grid: { rows: 5, columns: 5 },
        regions: [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3],
        solution: [2, 9, 10, 18, 21],
        timeLimit: 60,
        points: 150,
        explanation:
          "La solución coloca las coronas en las columnas 3, 5, 1, 4 y 2. Así cada fila, columna y región contiene una sola corona y ninguna toca a otra.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"queens">;
