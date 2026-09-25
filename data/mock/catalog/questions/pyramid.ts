import { defineQuestionCatalog } from "@/data/mock/catalog/questions/definition";

export const pyramidQuestions = defineQuestionCatalog([
  {
    slug: "pyramid-square-intruder",
    practicePoints: 100,
    type: "odd-one-out",
    publicPayload: {
      category: "Lógica",
      tags: {
        domains: ["mathematics"],
        topics: ["logic_puzzles"],
        cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
        formatSkills: ["classification", "deduction"],
        lifeSkills: [],
      },
      prompt: "¿Qué número rompe el patrón?",
      context: null,
      timeLimitMs: 12000,
      payload: {
        items: [
          {
            id: "square-9",
            label: "9",
          },
          {
            id: "square-16",
            label: "16",
          },
          {
            id: "square-25",
            label: "25",
          },
          {
            id: "square-27",
            label: "27",
          },
          {
            id: "square-36",
            label: "36",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation: "9, 16, 25 y 36 son cuadrados perfectos. 27 es el único que no lo es.",
        payload: {
          correctAnswer: "square-27",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "pyramid-growing-products",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Lógica",
      tags: {
        domains: ["mathematics"],
        topics: ["number_sequences"],
        cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
        formatSkills: ["deduction", "calculation"],
        lifeSkills: [],
      },
      prompt: "Completa la secuencia.",
      context: null,
      timeLimitMs: 18000,
      payload: {
        options: ["26", "28", "30", "32"],
        media: null,
        promptVisual: {
          type: "number-sequence",
          sequence: ["2", "6", "12", "20", "?"],
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Cada término multiplica dos enteros consecutivos: 1×2, 2×3, 3×4, 4×5 y 5×6. El siguiente valor es 30.",
        payload: {
          correctAnswer: "30",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "pyramid-constraint-order",
    practicePoints: 100,
    type: "ordering",
    publicPayload: {
      category: "Lógica",
      tags: {
        domains: ["mathematics"],
        topics: ["logic_puzzles"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["ordering", "deduction"],
        lifeSkills: [],
      },
      prompt:
        "Ordena de izquierda a derecha. Luna va inmediatamente después de Sol; Mar está antes que Sol; Nube está después de Luna; Río está antes que Mar.",
      context: null,
      timeLimitMs: 30000,
      payload: {
        items: ["Sol", "Río", "Nube", "Mar", "Luna"],
        directionLabels: {
          start: "Izquierda",
          end: "Derecha",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Las restricciones forman una única cadena: Río debe preceder a Mar, Mar a Sol, Luna va justo después de Sol y Nube queda al final.",
        payload: {
          correctOrder: ["Río", "Mar", "Sol", "Luna", "Nube"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "pyramid-shape-direction-matrix",
    practicePoints: 100,
    type: "logic-matrix",
    publicPayload: {
      category: "Lógica visual",
      tags: {
        domains: ["mathematics"],
        topics: ["visual_patterns"],
        cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
        formatSkills: ["deduction"],
        lifeSkills: [],
      },
      prompt: "¿Qué pieza completa la matriz?",
      context: null,
      timeLimitMs: 35000,
      payload: {
        pieces: [
          {
            id: "circle-up",
            symbol: "●↑",
            label: "Círculo y flecha arriba",
          },
          {
            id: "triangle-right",
            symbol: "▲→",
            label: "Triángulo y flecha derecha",
          },
          {
            id: "square-down",
            symbol: "■↓",
            label: "Cuadrado y flecha abajo",
          },
          {
            id: "triangle-down",
            symbol: "▲↓",
            label: "Triángulo y flecha abajo",
          },
          {
            id: "square-up",
            symbol: "■↑",
            label: "Cuadrado y flecha arriba",
          },
          {
            id: "circle-right",
            symbol: "●→",
            label: "Círculo y flecha derecha",
          },
          {
            id: "square-right",
            symbol: "■→",
            label: "Cuadrado y flecha derecha",
          },
          {
            id: "circle-down",
            symbol: "●↓",
            label: "Círculo y flecha abajo",
          },
          {
            id: "triangle-up",
            symbol: "▲↑",
            label: "Triángulo y flecha arriba",
          },
          {
            id: "triangle-left",
            symbol: "▲←",
            label: "Triángulo y flecha izquierda",
          },
          {
            id: "square-left",
            symbol: "■←",
            label: "Cuadrado y flecha izquierda",
          },
        ],
        cells: [
          "circle-up",
          "triangle-right",
          "square-down",
          "triangle-down",
          "square-up",
          "circle-right",
          "square-right",
          "circle-down",
          null,
        ],
        optionIds: ["triangle-up", "triangle-left", "circle-up", "square-left"],
        showPieceLabels: false,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Las figuras y las flechas rotan de forma independiente en cada fila y columna. La casilla final necesita un triángulo con flecha hacia arriba.",
        payload: {
          correctOptionId: "triangle-up",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "pyramid-connect-pairs-trap",
    practicePoints: 100,
    type: "connect-pairs",
    publicPayload: {
      category: "Lógica espacial",
      tags: {
        domains: ["mathematics"],
        topics: ["spatial_logic_puzzles"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["planning", "deduction"],
        lifeSkills: [],
      },
      prompt: "Conecta cada pareja de símbolos y cubre toda la cuadrícula.",
      context: null,
      timeLimitMs: 35000,
      payload: {
        grid: {
          rows: 5,
          columns: 5,
        },
        pairs: [
          {
            id: "circle",
            label: "Círculo",
            symbol: "●",
            endpoints: [0, 9],
            color: "#35e8ff",
          },
          {
            id: "triangle",
            label: "Triángulo",
            symbol: "▲",
            endpoints: [8, 10],
            color: "#d7ff18",
          },
          {
            id: "diamond",
            label: "Rombo",
            symbol: "◆",
            endpoints: [11, 18],
            color: "#ff6d73",
          },
          {
            id: "star",
            label: "Estrella",
            symbol: "★",
            endpoints: [17, 24],
            color: "#b994ff",
          },
        ],
        requireFullCoverage: true,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Cada símbolo se une con su pareja mediante una ruta ortogonal. Las cuatro rutas cubren las 25 casillas sin cruzarse ni solaparse.",
        payload: {
          paths: {
            circle: [0, 1, 2, 3, 4, 9],
            triangle: [8, 7, 6, 5, 10],
            diamond: [11, 12, 13, 14, 19, 18],
            star: [17, 16, 15, 20, 21, 22, 23, 24],
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "pyramid-secret-code",
    practicePoints: 100,
    type: "logic-code",
    publicPayload: {
      category: "Lógica deductiva",
      tags: {
        domains: ["mathematics"],
        topics: ["logic_puzzles"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["deduction"],
        lifeSkills: [],
      },
      prompt: "Deduce el código secreto de tres cifras.",
      context: null,
      timeLimitMs: 45000,
      payload: {
        clues: [
          {
            code: "529",
            hint: "Una cifra es correcta y está bien colocada.",
          },
          {
            code: "175",
            hint: "Dos cifras son correctas, pero están mal colocadas.",
          },
          {
            code: "638",
            hint: "Ninguna cifra es correcta.",
          },
          {
            code: "083",
            hint: "Una cifra es correcta, pero está mal colocada.",
          },
          {
            code: "760",
            hint: "Dos cifras son correctas, pero están mal colocadas.",
          },
        ],
        codeLength: 3,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "638 descarta 6, 3 y 8. En 083, el 0 es correcto y no ocupa la primera posición. 529 fija el 5 al principio; 175 coloca el 7 al final. El código es 507.",
        payload: {
          correctAnswer: "507",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "pyramid-summit-queens",
    practicePoints: 100,
    type: "queens",
    publicPayload: {
      category: "Lógica espacial",
      tags: {
        domains: ["mathematics"],
        topics: ["spatial_logic_puzzles"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["deduction", "planning"],
        lifeSkills: [],
      },
      prompt: "Coloca cinco coronas sin repetir fila, columna o región.",
      context: null,
      timeLimitMs: 60000,
      payload: {
        grid: {
          rows: 5,
          columns: 5,
        },
        regions: [0, 1, 1, 1, 4, 0, 2, 1, 4, 4, 0, 2, 1, 4, 3, 0, 2, 4, 4, 3, 2, 2, 3, 3, 3],
        prefilledQueens: [2],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La solución sitúa las coronas en las columnas 3, 1, 4, 2 y 5. Cada fila, columna y región contiene una sola corona y ninguna toca a otra.",
        payload: {
          solution: [2, 5, 13, 16, 24],
        },
      },
      reveals: [],
    },
  },
] as const);
