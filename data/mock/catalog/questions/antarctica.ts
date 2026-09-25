import { defineQuestionCatalog } from "@/data/mock/catalog/questions/definition";

export const antarcticaQuestions = defineQuestionCatalog([
  {
    slug: "ross-sea-transantarctic-range",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Geografía antártica",
      tags: {
        domains: ["geography", "natural_sciences"],
        topics: ["maps", "orientation"],
        cognitiveSkills: ["comprehension", "memory", "decision_making"],
        formatSkills: ["recall", "interpretation"],
        lifeSkills: ["environmental_awareness"],
      },
      prompt: "¿Qué cordillera marca el paso hacia el interior antártico?",
      context: null,
      timeLimitMs: 24000,
      payload: {
        options: [
          "Montes Ellsworth",
          "Cordillera Transantártica",
          "Cordillera de la Península Antártica",
          "Montañas Prince Charles",
        ],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El sector del mar de Ross está flanqueado por la Cordillera Transantártica, que marca el paso desde la costa hacia el interior antártico. El registro permite describir la dirección de P-17, no su intención.",
        payload: {
          correctAnswer: "Cordillera Transantártica",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "antarctic-circle-map",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Geografía polar",
      tags: {
        domains: ["geography", "natural_sciences"],
        topics: ["maps", "orientation"],
        cognitiveSkills: ["comprehension", "memory", "decision_making"],
        formatSkills: ["recall", "interpretation"],
        lifeSkills: ["environmental_awareness"],
      },
      prompt: "¿Qué línea de latitud delimita aproximadamente la región polar antártica?",
      context: null,
      timeLimitMs: 25000,
      payload: {
        options: [
          "Ecuador",
          "Trópico de Capricornio",
          "Círculo Polar Antártico",
          "Meridiano de Greenwich",
        ],
        media: {
          type: "image",
          src: "/visuals/p17/antarctic-latitudes-commons.svg",
          alt: "Mapa del mundo con los principales círculos de latitud y la Antártida en el extremo sur",
          fit: "contain",
        },
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El Círculo Polar Antártico es la línea de latitud situada aproximadamente a 66 grados y 33 minutos al sur del ecuador. Delimita la región polar antártica.",
        payload: {
          correctAnswer: "Círculo Polar Antártico",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "polar-fauna-classification",
    practicePoints: 100,
    type: "classification",
    publicPayload: {
      category: "Fauna polar",
      tags: {
        domains: ["natural_sciences", "geography"],
        topics: ["biology_taxonomy"],
        cognitiveSkills: ["comprehension", "critical_thinking"],
        formatSkills: ["classification", "comparison"],
        lifeSkills: ["environmental_awareness"],
      },
      prompt: "Clasifica cada especie según la región polar en la que vive habitualmente.",
      context: null,
      timeLimitMs: 35000,
      payload: {
        items: [
          {
            label: "Foca de Weddell",
          },
          {
            label: "Morsa",
          },
          {
            label: "Pingüino emperador",
          },
          {
            label: "Zorro ártico",
          },
          {
            label: "Oso polar",
          },
          {
            label: "Pingüino de Adelia",
          },
        ],
        categories: ["Antártida", "Ártico"],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El pingüino emperador, el pingüino de Adelia y la foca de Weddell son especies antárticas. El oso polar, la morsa y el zorro ártico viven en la región ártica.",
        payload: {
          categoriesByItem: {
            "Foca de Weddell": "Antártida",
            Morsa: "Ártico",
            "Pingüino emperador": "Antártida",
            "Zorro ártico": "Ártico",
            "Oso polar": "Ártico",
            "Pingüino de Adelia": "Antártida",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "clear-camp-escape",
    practicePoints: 100,
    type: "escape",
    publicPayload: {
      category: "Protocolo ambiental",
      tags: {
        domains: ["natural_sciences", "technology", "geography"],
        topics: ["orientation"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["deduction"],
        lifeSkills: ["environmental_awareness", "adaptability"],
      },
      prompt:
        "Saca el trípode por la salida de servicio y despeja el corredor antes de que P-17 llegue al campamento.",
      context: null,
      timeLimitMs: 40000,
      payload: {
        grid: {
          rows: 6,
          columns: 6,
          exit: {
            side: "right",
            row: 2,
          },
        },
        initialBlocks: [
          {
            id: "tripod",
            kind: "target",
            orientation: "horizontal",
            row: 2,
            column: 0,
            length: 2,
            label: "Trípode",
            symbol: "T",
          },
          {
            id: "crate-a",
            kind: "obstacle",
            orientation: "vertical",
            row: 0,
            column: 2,
            length: 3,
            label: "Caja A",
            symbol: "A",
          },
          {
            id: "sled-b",
            kind: "obstacle",
            orientation: "horizontal",
            row: 4,
            column: 1,
            length: 3,
            label: "Trineo B",
            symbol: "B",
          },
          {
            id: "case-c",
            kind: "obstacle",
            orientation: "vertical",
            row: 2,
            column: 5,
            length: 3,
            label: "Estuche C",
            symbol: "C",
          },
          {
            id: "case-d",
            kind: "obstacle",
            orientation: "horizontal",
            row: 5,
            column: 2,
            length: 3,
            label: "Estuche D",
            symbol: "D",
          },
          {
            id: "cable-e",
            kind: "obstacle",
            orientation: "horizontal",
            row: 3,
            column: 3,
            length: 2,
            label: "Cable E",
            symbol: "E",
          },
          {
            id: "supply-f",
            kind: "obstacle",
            orientation: "vertical",
            row: 0,
            column: 0,
            length: 2,
            label: "Suministros F",
            symbol: "F",
          },
          {
            id: "case-g",
            kind: "obstacle",
            orientation: "horizontal",
            row: 0,
            column: 3,
            length: 2,
            label: "Estuche G",
            symbol: "G",
          },
        ],
        instruction: null,
        hideInstruction: true,
        objectiveLabel: "Retira el trípode por la salida de servicio",
        hideObjectiveLabel: true,
        completionMessage: "Corredor despejado. El trípode ha salido por el acceso de servicio.",
        boardLabel: "Plano del corredor del campamento con trípode, cajas y trineo",
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Todo el movimiento ocurre dentro del equipo humano. Al retirar el trípode por la salida de servicio, el corredor queda como estaba antes de instalar el campamento.",
        payload: {
          referenceSolution: [
            {
              blockId: "case-c",
              from: 2,
              to: 0,
            },
            {
              blockId: "sled-b",
              from: 1,
              to: 3,
            },
            {
              blockId: "case-d",
              from: 2,
              to: 3,
            },
            {
              blockId: "crate-a",
              from: 0,
              to: 3,
            },
            {
              blockId: "tripod",
              from: 0,
              to: 3,
            },
            {
              blockId: "crate-a",
              from: 3,
              to: 0,
            },
            {
              blockId: "sled-b",
              from: 3,
              to: 0,
            },
            {
              blockId: "case-d",
              from: 3,
              to: 0,
            },
            {
              blockId: "case-c",
              from: 0,
              to: 3,
            },
            {
              blockId: "tripod",
              from: 3,
              to: 4,
            },
          ],
          optimalMoves: 10,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "p17-evidence-matrix",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Análisis de evidencias",
      tags: {
        domains: ["natural_sciences", "mathematics"],
        topics: ["orientation"],
        cognitiveSkills: ["logical_reasoning", "critical_thinking"],
        formatSkills: ["interpretation", "deduction"],
        lifeSkills: ["environmental_awareness"],
      },
      prompt: "¿Qué candidato coincide completamente con el registro?",
      context:
        "Registro de Nadir: Señal blanca en el lado izquierdo del pecho · Trayectoria del nordeste al suroeste · Casi dos días después del inicio",
      timeLimitMs: 35000,
      payload: {
        options: ["Candidato A", "Candidato B", "Candidato C", "Ningún candidato"],
        media: {
          type: "image",
          src: "/visuals/p17/evidence-matrix.svg",
          alt: "Matriz comparativa de tres candidatos con marca de pecho, rumbo y ventana temporal",
          fit: "contain",
        },
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El candidato A es la única fila que coincide en marca, rumbo y ventana temporal. La coincidencia permite continuar la identificación, pero no explica la conducta del animal.",
        payload: {
          correctAnswer: "Candidato A",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "p17-route-zip",
    practicePoints: 100,
    type: "zip",
    publicPayload: {
      category: "Reconstrucción espacial",
      tags: {
        domains: ["geography", "mathematics"],
        topics: ["orientation"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["deduction"],
        lifeSkills: ["environmental_awareness"],
      },
      prompt: "Reconstruye la ruta uniendo los seis registros en orden.",
      context: null,
      timeLimitMs: 45000,
      payload: {
        grid: {
          rows: 5,
          columns: 5,
        },
        checkpoints: [
          {
            value: 1,
            cell: 20,
            label: "Colonia",
          },
          {
            value: 2,
            cell: 18,
            label: "Primer desvío",
          },
          {
            value: 3,
            cell: 11,
            label: "Campamento base",
          },
          {
            value: 4,
            cell: 8,
            label: "Baliza H-3",
          },
          {
            value: 5,
            cell: 5,
            label: "Nadir",
          },
          {
            value: 6,
            cell: 4,
            label: "Último registro",
          },
        ],
        instruction: null,
        mapNote: null,
        boardLabel:
          "Cuadrícula de observación de cinco por cinco con seis registros desde la colonia hasta el interior",
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La línea conecta todos los registros en orden y no contradice ninguna posición observada. Completarla no convierte el recorrido en una decisión.",
        payload: {
          solution: [
            20, 21, 22, 23, 24, 19, 18, 17, 16, 15, 10, 11, 12, 13, 14, 9, 8, 7, 6, 5, 0, 1, 2, 3,
            4,
          ],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "p17-observation-order",
    practicePoints: 100,
    type: "ordering",
    publicPayload: {
      category: "Cronología de campo",
      tags: {
        domains: ["natural_sciences", "geography"],
        topics: ["orientation"],
        cognitiveSkills: ["scientific_reasoning", "critical_thinking"],
        formatSkills: ["ordering", "interpretation"],
        lifeSkills: ["environmental_awareness"],
      },
      prompt: "Ordena únicamente los hechos registrados. La secuencia no debe añadir una causa.",
      context: null,
      timeLimitMs: 35000,
      payload: {
        items: [
          "La colonia avanza hacia el agua abierta",
          "P-17 se separa y toma dirección hacia el interior",
          "P-17 abandona Nadir y continúa hacia las montañas",
          "La cámara de Nadir registra una identificación compatible con P-17",
          "P-17 cruza el campamento base después de retirar el equipo",
        ],
        directionLabels: {
          start: "Primero",
          end: "Finalmente",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La cronología establece qué ocurrió antes y después. No establece enfermedad, pérdida de orientación ni intención.",
        payload: {
          correctOrder: [
            "La colonia avanza hacia el agua abierta",
            "P-17 se separa y toma dirección hacia el interior",
            "P-17 cruza el campamento base después de retirar el equipo",
            "La cámara de Nadir registra una identificación compatible con P-17",
            "P-17 abandona Nadir y continúa hacia las montañas",
          ],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "p17-final-record",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Registro científico",
      tags: {
        domains: ["natural_sciences", "geography"],
        topics: ["orientation"],
        cognitiveSkills: ["scientific_reasoning", "critical_thinking"],
        formatSkills: ["interpretation", "deduction"],
        lifeSkills: ["environmental_awareness"],
      },
      prompt:
        "¿Cuál de estas conclusiones puede incluirse en el informe final sin añadir información no observada?",
      context: null,
      timeLimitMs: 40000,
      payload: {
        options: [
          "P-17 estaba perdido y buscaba alejarse de la colonia.",
          "P-17 continuó hacia las montañas. La causa de su trayectoria no pudo determinarse.",
          "P-17 seguía un sonido procedente de las montañas.",
          "P-17 quería encontrar otra colonia en el interior.",
        ],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Los registros permiten describir la ruta de P-17 y una identificación compatible en Nadir. Ninguno permite afirmar que estuviera perdido, que hubiera tomado una decisión concreta o por qué se alejó.",
        payload: {
          correctAnswer:
            "P-17 continuó hacia las montañas. La causa de su trayectoria no pudo determinarse.",
        },
      },
      reveals: [],
    },
  },
] as const);
