import { defineQuestionCatalog } from "@/data/mock/catalog/questions/definition";

export const spainSurvivalQuestions = defineQuestionCatalog([
  {
    slug: "spain-survival-teide",
    practicePoints: 100,
    type: "true-false",
    publicPayload: {
      category: "Geografía y naturaleza",
      tags: {
        domains: ["geography"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "El Teide es el pico más alto de España.",
      context: null,
      timeLimitMs: 9000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "El Teide, con 3.718 metros, es el pico más alto de España y se encuentra en la isla de Tenerife (Canarias).",
        payload: {
          correctAnswer: true,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-felipe-ii",
    practicePoints: 100,
    type: "progressive-clues",
    publicPayload: {
      category: "Historia",
      tags: {
        domains: ["history"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["deduction", "recall"],
        lifeSkills: [],
      },
      prompt: "Identifica al monarca.",
      context: null,
      timeLimitMs: 25000,
      payload: {
        clueCount: 3,
        cluePenalty: 30,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Felipe II (1527-1598), hijo de Carlos I, trasladó la corte a Madrid en 1561 y fue conocido como «el Prudente».",
        payload: {
          correctAnswer: "Felipe II",
          acceptedAnswers: ["Felipe II", "Felipe segundo", "Felipe 2", "Philip II"],
        },
      },
      reveals: [
        {
          clueIndex: 0,
          clue: "Fue hijo de Carlos I de España.",
        },
        {
          clueIndex: 1,
          clue: "Durante su reinado, Madrid se convirtió en sede permanente de la corte.",
        },
        {
          clueIndex: 2,
          clue: "Fue conocido como «el Prudente».",
        },
      ],
    },
  },
  {
    slug: "spain-survival-map-santa-cruz-tenerife",
    practicePoints: 100,
    type: "heat-map",
    publicPayload: {
      category: "Mapa",
      tags: {
        domains: ["geography"],
        topics: ["maps"],
        cognitiveSkills: ["comprehension", "memory"],
        formatSkills: ["interpretation"],
        lifeSkills: [],
      },
      prompt: "Marca aproximadamente dónde está Santa Cruz de Tenerife.",
      context: null,
      timeLimitMs: 12000,
      payload: {
        surface: {
          src: "/visuals/spain-survival/canary_islands_map.svg",
          alt: "Mapa mudo de las Islas Canarias",
          width: 1474.6973,
          height: 655.01733,
          fit: "contain",
        },
        targetLabel: "Santa Cruz de Tenerife",
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Santa Cruz de Tenerife está en el noreste de la isla de Tenerife, en el archipiélago canario.",
        payload: {
          target: {
            x: 0.41,
            y: 0.49,
          },
          fullCreditRadius: 0.035,
          toleranceRadius: 0.1,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-food-odd",
    practicePoints: 100,
    type: "matching",
    publicPayload: {
      category: "Gastronomía",
      tags: {
        domains: ["culture"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory"],
        formatSkills: ["comparison"],
        lifeSkills: [],
      },
      prompt: "Relaciona cada alimento con su lugar tradicional de origen.",
      context: null,
      timeLimitMs: 18000,
      payload: {
        leftItems: [
          {
            id: "fabada",
            label: "Fabada",
          },
          {
            id: "paella",
            label: "Paella",
          },
          {
            id: "ensaimada",
            label: "Ensaimada",
          },
        ],
        rightItems: [
          {
            id: "baleares",
            label: "Islas Baleares",
          },
          {
            id: "asturias",
            label: "Asturias",
          },
          {
            id: "valencia",
            label: "Comunidad Valenciana",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La fabada es un plato tradicional de Asturias, la paella de la Comunidad Valenciana y la ensaimada de las Islas Baleares.",
        payload: {
          matches: {
            fabada: "asturias",
            paella: "valencia",
            ensaimada: "baleares",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-city-monument",
    practicePoints: 100,
    type: "matching",
    publicPayload: {
      category: "Patrimonio",
      tags: {
        domains: ["geography", "culture"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory"],
        formatSkills: ["comparison"],
        lifeSkills: [],
      },
      prompt: "Empareja cada ciudad con su monumento.",
      context: null,
      timeLimitMs: 18000,
      payload: {
        leftItems: [
          {
            id: "granada",
            label: "Granada",
          },
          {
            id: "segovia",
            label: "Segovia",
          },
          {
            id: "santiago",
            label: "Santiago de Compostela",
          },
        ],
        rightItems: [
          {
            id: "catedral",
            label: "Catedral de Santiago",
          },
          {
            id: "alhambra",
            label: "La Alhambra",
          },
          {
            id: "acueducto",
            label: "Acueducto romano",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La Alhambra está en Granada, el acueducto romano en Segovia y la catedral marca el centro histórico de Santiago de Compostela.",
        payload: {
          matches: {
            granada: "alhambra",
            segovia: "acueducto",
            santiago: "catedral",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-west-east-cities",
    practicePoints: 100,
    type: "ordering",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography"],
        topics: ["orientation", "maps"],
        cognitiveSkills: ["pattern_recognition", "memory"],
        formatSkills: ["ordering"],
        lifeSkills: [],
      },
      prompt: "Ordena estas ciudades de norte a sur.",
      context: null,
      timeLimitMs: 16000,
      payload: {
        items: ["Córdoba", "Santander", "Málaga", "Madrid"],
        directionLabels: {
          start: "Más al norte",
          end: "Más al sur",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Santander está en el norte, Madrid en el centro, Córdoba en el sur y Málaga más al sur.",
        payload: {
          correctOrder: ["Santander", "Madrid", "Córdoba", "Málaga"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-don-quixote-real-name",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Literatura",
      tags: {
        domains: ["literature", "language_communication"],
        topics: ["word_groups"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Cuál es el nombre original del personaje de Don Quijote de la Mancha?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["Miguel Quejana", "Alonso Quijano", "Amadís de Gaula", "Quijote"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El personaje adopta el nombre de don Quijote, pero al final de la novela se le identifica como Alonso Quijano.",
        payload: {
          correctAnswer: "Alonso Quijano",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-ramon-cajal",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Ciencia",
      tags: {
        domains: ["natural_sciences", "history"],
        topics: ["scientists"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt:
        "¿Qué científico español recibió el Premio Nobel por sus investigaciones sobre la estructura del sistema nervioso?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: [
          "Severo Ochoa",
          "Santiago Ramón y Cajal",
          "Gregorio Marañón",
          "Leonardo Torres Quevedo",
        ],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Ramón y Cajal compartió el Nobel de Fisiología o Medicina de 1906 por sus investigaciones sobre la estructura del sistema nervioso.",
        payload: {
          correctAnswer: "Santiago Ramón y Cajal",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-cinema",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Cine",
      tags: {
        domains: ["media_entertainment"],
        topics: ["cinema"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt:
        "¿Qué director español ganó el Óscar a mejor película de habla no inglesa por «Todo sobre mi madre»?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["Pedro Almodóvar", "Luis Buñuel", "Alejandro Amenábar", "Fernando Trueba"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation: "Pedro Almodóvar ganó ese Óscar por «Todo sobre mi madre», estrenada en 1999.",
        payload: {
          correctAnswer: "Pedro Almodóvar",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-surface-area",
    practicePoints: 100,
    type: "estimation",
    publicPayload: {
      category: "Matemáticas y geografía",
      tags: {
        domains: ["geography", "mathematics"],
        topics: ["maps"],
        cognitiveSkills: ["quantitative_reasoning"],
        formatSkills: ["estimation"],
        lifeSkills: [],
      },
      prompt: "¿Cuál es aproximadamente la superficie de España?",
      context: null,
      timeLimitMs: 14000,
      payload: {
        min: 300000,
        max: 700000,
        step: 10000,
        initialValue: 450000,
        unit: "km²",
        media: null,
      },
    },
    privatePayload: {
      solution: {
        explanation: "España tiene una superficie aproximada de 505.990 km².",
        payload: {
          correctAnswer: 506000,
          tolerance: 50000,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-sagrada-progressive",
    practicePoints: 100,
    type: "progressive-image",
    publicPayload: {
      category: "Arquitectura",
      tags: {
        domains: ["art_design", "culture"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["interpretation"],
        lifeSkills: [],
      },
      prompt: "Identifica el monumento que aparece.",
      context: null,
      timeLimitMs: 16000,
      payload: {
        surface: {
          src: "/visuals/spain-survival/sagrada-familia.jpg",
          alt: "Fotografía de la Sagrada Familia vista desde el Parc Güell",
          width: 1920,
          height: 1271,
          fit: "contain",
        },
        revealDurationMs: 7,
        answerLabel: null,
        answerPlaceholder: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La Sagrada Familia es la basílica diseñada por Antoni Gaudí y uno de los monumentos más reconocibles de Barcelona.",
        payload: {
          correctAnswer: "Sagrada Familia",
          acceptedAnswers: [
            "sagrada familia",
            "la sagrada familia",
            "basílica de la sagrada familia",
          ],
          solutionAlt: "Fotografía de la Sagrada Familia de Barcelona",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-nadal-grand-slams",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Deportes",
      tags: {
        domains: ["sports"],
        topics: ["olympics"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Cuántos títulos de Grand Slam ganó Rafael Nadal en su carrera?",
      context: null,
      timeLimitMs: 12000,
      payload: {
        options: ["14", "20", "22", "32"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Rafael Nadal ganó 22 títulos de Grand Slam: 14 Roland Garros, 2 Wimbledon, 2 Australian Open y 4 US Open.",
        payload: {
          correctAnswer: "22",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-history-order",
    practicePoints: 100,
    type: "ordering",
    publicPayload: {
      category: "Historia",
      tags: {
        domains: ["history"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["ordering"],
        lifeSkills: [],
      },
      prompt: "Ordena cronológicamente estos acontecimientos de la historia de España.",
      context: null,
      timeLimitMs: 18000,
      payload: {
        items: [
          "Aprobación de la Constitución española actual.",
          "Inicio de la Guerra Civil.",
          "Constitución de Cádiz.",
          "Conquista de Granada por los Reyes Católicos.",
        ],
        directionLabels: {
          start: "Más antiguo",
          end: "Más reciente",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Conquista de Granada — 1492. Constitución de Cádiz — 1812. Inicio de la Guerra Civil — 1936. Constitución española actual — 1978.",
        payload: {
          correctOrder: [
            "Conquista de Granada por los Reyes Católicos.",
            "Constitución de Cádiz.",
            "Inicio de la Guerra Civil.",
            "Aprobación de la Constitución española actual.",
          ],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-literature-publication-order",
    practicePoints: 100,
    type: "ordering",
    publicPayload: {
      category: "Literatura e historia",
      tags: {
        domains: ["literature", "history"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["ordering"],
        lifeSkills: [],
      },
      prompt: "Ordena estas obras por la fecha de su primera publicación.",
      context: null,
      timeLimitMs: 18000,
      payload: {
        items: ["Nada", "Lazarillo de Tormes", "La Regenta", "Don Quijote de la Mancha"],
        directionLabels: {
          start: "Más antigua",
          end: "Más reciente",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Lazarillo de Tormes — 1554. Don Quijote de la Mancha — 1605, primera parte. La Regenta — 1884-1885. Nada — 1945.",
        payload: {
          correctOrder: ["Lazarillo de Tormes", "Don Quijote de la Mancha", "La Regenta", "Nada"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-sports-matching",
    practicePoints: 100,
    type: "matching",
    publicPayload: {
      category: "Deportes",
      tags: {
        domains: ["sports"],
        topics: ["olympics"],
        cognitiveSkills: ["memory"],
        formatSkills: ["comparison"],
        lifeSkills: [],
      },
      prompt: "Relaciona cada deportista con su deporte.",
      context: null,
      timeLimitMs: 20000,
      payload: {
        leftItems: [
          {
            id: "carolina-marin",
            label: "Carolina Marín",
          },
          {
            id: "miguel-indurain",
            label: "Miguel Induráin",
          },
          {
            id: "mireia-belmonte",
            label: "Mireia Belmonte",
          },
          {
            id: "fernando-alonso",
            label: "Fernando Alonso",
          },
        ],
        rightItems: [
          {
            id: "badminton",
            label: "Bádminton",
          },
          {
            id: "ciclismo",
            label: "Ciclismo",
          },
          {
            id: "natacion",
            label: "Natación",
          },
          {
            id: "formula1",
            label: "Fórmula 1",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Carolina Marín es campeona de bádminton, Miguel Induráin ganó cinco Tours de Francia, Mireia Belmonte es nadadora olímpica y Fernando Alonso es piloto de Fórmula 1.",
        payload: {
          matches: {
            "carolina-marin": "badminton",
            "miguel-indurain": "ciclismo",
            "mireia-belmonte": "natacion",
            "fernando-alonso": "formula1",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-alhambra-pattern",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Matemáticas",
      tags: {
        domains: ["mathematics"],
        topics: ["number_sequences"],
        cognitiveSkills: ["pattern_recognition"],
        formatSkills: ["deduction"],
        lifeSkills: [],
      },
      prompt: "En un mosaico de la Alhambra se visualiza una secuencia, ¿qué número sigue?",
      context: null,
      timeLimitMs: 30000,
      payload: {
        options: ["32", "34", "36", "39"],
        media: null,
        promptVisual: {
          type: "number-sequence",
          eyebrow: "Mosaico de la Alhambra",
          sequence: ["4", "7", "13", "22", "__"],
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Las diferencias aumentan de 3 en 3: +3, +6, +9, +12. El siguiente número es 22 + 12 = 34.",
        payload: {
          correctAnswer: "34",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-art-matching",
    practicePoints: 100,
    type: "progressive-image",
    publicPayload: {
      category: "Arte",
      tags: {
        domains: ["art_design", "culture"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["interpretation"],
        lifeSkills: [],
      },
      prompt: "¿Quién pintó esta obra?",
      context: null,
      timeLimitMs: 16000,
      payload: {
        surface: {
          src: "/visuals/spain-survival/las-meninas-velazquez.jpg",
          alt: "Las Meninas de Diego Velázquez",
          width: 960,
          height: 1105,
          fit: "contain",
        },
        revealDurationMs: 7,
        answerLabel: null,
        answerPlaceholder: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Las Meninas fue pintada por Diego Velázquez en 1656 y es una de las obras más importantes del barroco español.",
        payload: {
          correctAnswer: "Diego Velázquez",
          acceptedAnswers: ["Diego Velázquez", "Velázquez"],
          solutionAlt: "Las Meninas de Diego Velázquez",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-seat-rows-total",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Matemáticas",
      tags: {
        domains: ["mathematics"],
        topics: ["arithmetic"],
        cognitiveSkills: ["quantitative_reasoning", "problem_solving"],
        formatSkills: ["calculation"],
        lifeSkills: [],
      },
      prompt:
        "En una plaza hay cinco filas de asientos. La primera tiene 12 asientos y cada fila siguiente tiene dos más que la anterior. ¿Cuántos asientos hay en total?",
      context: null,
      timeLimitMs: 30000,
      payload: {
        options: ["60", "70", "80", "90"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Primera: 12, Segunda: 14, Tercera: 16, Cuarta: 18, Quinta: 20. Total: 12 + 14 + 16 + 18 + 20 = 80 asientos.",
        payload: {
          correctAnswer: "80",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-catalan-dance",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Cultura",
      tags: {
        domains: ["culture"],
        topics: ["landmarks"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué baile tradicional catalán se realiza formando círculos?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["Flamenco", "Jota", "Sardana", "Muñeira"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La sardana es el baile tradicional catalán en el que los participantes se toman de las manos formando un círculo.",
        payload: {
          correctAnswer: "Sardana",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "spain-survival-oak-tree",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Naturaleza",
      tags: {
        domains: ["natural_sciences"],
        topics: ["biology_taxonomy"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt:
        "¿Cuál de estos árboles es característico de la dehesa ibérica y produce bellotas muy utilizadas en la alimentación del cerdo ibérico?",
      context: null,
      timeLimitMs: 12000,
      payload: {
        options: ["Encina", "Olivo", "Pino piñonero", "Naranjo"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La encina (Quercus ilex) es el árbol que produce las bellotas con las que se alimenta el cerdo ibérico, especialmente en la dehesa.",
        payload: {
          correctAnswer: "Encina",
        },
      },
      reveals: [],
    },
  },
] as const);
