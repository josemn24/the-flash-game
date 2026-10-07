import type { QuestionFormatGuide } from "../../catalogTypes";
import { SCORING_POLICIES } from "../../scoringPolicies";

export const guide = {
  id: "pipes",
  slug: "tuberias",
  name: "Tuberías",
  shortName: "Tuberías",
  summary: "Rotar piezas para conectar una única red de tuberías sin salidas abiertas.",
  description: [
    "Cada casilla contiene una pieza de tubería que gira al tocarla. El objetivo es conectar las 25 piezas a una fuente sin dejar extremos abiertos.",
    "La red se ilumina desde la fuente a medida que las conexiones encajan. La ronda termina automáticamente al completar una red única.",
  ],
  recommendations: [
    "Puzzles espaciales breves",
    "Rondas táctiles de deducción",
    "Retos visuales con reglas inmediatas",
  ],
  avoidWhen: [
    "Se busca una respuesta de conocimiento inmediato",
    "Las piezas no se distinguen con claridad en una pantalla pequeña",
    "El tablero necesita explicación adicional para entender su objetivo",
  ],
  rules: [
    "Toca una pieza para girarla 90 grados en sentido horario",
    "Todas las piezas deben formar una sola red conectada a la fuente",
    "No puede quedar ninguna conexión abierta hacia otra pieza ni hacia el borde",
    "La solución se envía automáticamente al completar la red",
  ],
  authoringTips: [
    "Usa configuraciones con una sola solución visualmente distinta",
    "Parte de una red válida y gira las piezas para crear el tablero inicial",
    "Mantén el objetivo visible y evita mezclar reglas de entrada y salida en la misma ronda",
  ],
  accessibility: [
    "Cada pieza debe ser un botón con fila, columna, forma y orientación anunciadas",
    "Permite mover el foco con flechas y girar con Enter o Espacio",
    "Distingue la red conectada con brillo y contraste, no solo con color",
    "Anuncia los giros y la resolución sin desplazar el foco",
  ],
  mediaSupport: ["Cuadrícula ortogonal 5 × 5", "Piezas de tubería SVG", "Fuente visual"],
  timing: {
    recommendedSeconds: "45–60 s",
    notes:
      "Los giros no modifican la puntuación; solo importa completar la red antes del tiempo límite.",
  },
  scoring: SCORING_POLICIES.pipes,
  examples: [
    {
      title: "Red eléctrica",
      question: {
        id: "guide-pipes",
        type: "pipes",
        category: "Lógica espacial",
        tags: {
          domains: ["mathematics"],
          topics: ["spatial_logic_puzzles"],
          cognitiveSkills: ["logical_reasoning", "problem_solving"],
          formatSkills: ["deduction", "planning"],
        },
        question: "Rota las piezas hasta conectar toda la red con la fuente.",
        grid: { rows: 5, columns: 5 },
        tiles: [
          "end",
          "corner",
          "end",
          "corner",
          "corner",
          "tee",
          "corner",
          "end",
          "corner",
          "straight",
          "corner",
          "corner",
          "end",
          "end",
          "tee",
          "corner",
          "tee",
          "tee",
          "straight",
          "corner",
          "end",
          "corner",
          "tee",
          "straight",
          "end",
        ],
        initialRotations: [
          3, 3, 0, 0, 0, 2, 1, 3, 2, 1, 3, 0, 0, 0, 0, 3, 0, 3, 0, 2, 2, 1, 1, 0, 0,
        ],
        solutionRotations: [
          2, 1, 3, 1, 2, 0, 3, 1, 3, 0, 0, 2, 2, 1, 2, 1, 2, 0, 1, 3, 0, 0, 3, 1, 3,
        ],
        source: 17,
        timeLimit: 55,
        points: 150,
        explanation:
          "Todas las piezas quedan conectadas a la fuente central y ningún extremo queda abierto. La red resultante no contiene bucles.",
      },
    },
  ],
} satisfies QuestionFormatGuide<"pipes">;
