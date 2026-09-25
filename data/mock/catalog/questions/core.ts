import { defineQuestionCatalog } from "@/data/mock/catalog/questions/definition";

export const coreQuestions = defineQuestionCatalog([
  {
    slug: "capital-canada",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography"],
        topics: ["capitals"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Cuál es la capital de Canadá?",
      context: null,
      timeLimitMs: 12000,
      payload: {
        options: ["Toronto", "Ottawa", "Vancouver", "Montreal"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Ottawa es la capital de Canadá desde 1857, cuando fue elegida por la reina Victoria.",
        payload: {
          correctAnswer: "Ottawa",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sound-space",
    practicePoints: 100,
    type: "true-false",
    publicPayload: {
      category: "Ciencia",
      tags: {
        domains: ["natural_sciences"],
        topics: ["sound_waves"],
        cognitiveSkills: ["scientific_reasoning"],
        formatSkills: ["interpretation"],
        lifeSkills: [],
      },
      prompt: "El sonido puede viajar por el vacío del espacio.",
      context: null,
      timeLimitMs: 9000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "El sonido necesita un medio material por el que propagarse; en el vacío no puede viajar.",
        payload: {
          correctAnswer: false,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "war-year",
    practicePoints: 120,
    type: "short-text",
    publicPayload: {
      category: "Historia",
      tags: {
        domains: ["history"],
        topics: ["world_war_ii"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿En qué año terminó la Segunda Guerra Mundial?",
      context: null,
      timeLimitMs: 13000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "La Segunda Guerra Mundial terminó en 1945, tras la rendición de Alemania y Japón.",
        payload: {
          correctAnswer: "1945",
          acceptedAnswers: ["1945", "mil novecientos cuarenta y cinco"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "japan-flag",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Banderas",
      tags: {
        domains: ["geography", "culture"],
        topics: ["countries_flags"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall", "interpretation"],
        lifeSkills: [],
      },
      prompt: "¿A qué país pertenece esta bandera?",
      context: null,
      timeLimitMs: 11000,
      payload: {
        options: ["Japón", "Bangladés", "Corea del Sur", "Indonesia"],
        media: {
          type: "illustration",
          id: "japan-flag",
          alt: "Bandera blanca con un círculo rojo en el centro",
        },
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El círculo rojo representa el sol. Japón es conocido como el país del sol naciente.",
        payload: {
          correctAnswer: "Japón",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "olympic-rings",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Deporte",
      tags: {
        domains: ["sports"],
        topics: ["olympics"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Cuántos anillos tiene el símbolo olímpico?",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["Cuatro", "Cinco", "Seis", "Siete"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "El emblema olímpico está formado por cinco anillos entrelazados de distintos colores.",
        payload: {
          correctAnswer: "Cinco",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "avatar-director",
    practicePoints: 120,
    type: "short-text",
    publicPayload: {
      category: "Cine",
      tags: {
        domains: ["media_entertainment"],
        topics: ["cinema"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué director llevó Avatar a la gran pantalla?",
      context: null,
      timeLimitMs: 15000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation: "James Cameron escribió y dirigió Avatar, estrenada en 2009.",
        payload: {
          correctAnswer: "James Cameron",
          acceptedAnswers: ["James Cameron", "Cameron"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "saturn-rings",
    practicePoints: 110,
    type: "multiple-choice",
    publicPayload: {
      category: "Astronomía",
      tags: {
        domains: ["natural_sciences"],
        topics: ["astronomy_planets"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall", "interpretation"],
        lifeSkills: [],
      },
      prompt: "¿Qué planeta estás viendo?",
      context: null,
      timeLimitMs: 12000,
      payload: {
        options: ["Júpiter", "Saturno", "Urano", "Neptuno"],
        media: {
          type: "illustration",
          id: "saturn",
          alt: "Ilustración de un planeta dorado rodeado por grandes anillos",
        },
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Saturno destaca por su amplio sistema de anillos, compuesto sobre todo por hielo y roca.",
        payload: {
          correctAnswer: "Saturno",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "mercury-hot",
    practicePoints: 100,
    type: "true-false",
    publicPayload: {
      category: "Espacio",
      tags: {
        domains: ["natural_sciences"],
        topics: ["astronomy_planets"],
        cognitiveSkills: ["scientific_reasoning"],
        formatSkills: ["interpretation"],
        lifeSkills: [],
      },
      prompt: "Mercurio es el planeta más caliente del sistema solar.",
      context: null,
      timeLimitMs: 8000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "Venus es el más caliente debido a su densa atmósfera y a un intenso efecto invernadero.",
        payload: {
          correctAnswer: false,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "queen-song",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Música",
      tags: {
        domains: ["music"],
        topics: ["popular_music"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué grupo publicó «Bohemian Rhapsody»?",
      context: null,
      timeLimitMs: 11000,
      payload: {
        options: ["The Beatles", "Queen", "ABBA", "The Rolling Stones"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Queen lanzó «Bohemian Rhapsody» en 1975 dentro del álbum A Night at the Opera.",
        payload: {
          correctAnswer: "Queen",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "sequence",
    practicePoints: 130,
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
      prompt: "Completa la secuencia: 2, 4, 8, 16, …",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["18", "24", "30", "32"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation: "Cada número es el doble del anterior, así que 16 x 2 = 32.",
        payload: {
          correctAnswer: "32",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "letter-pattern",
    practicePoints: 120,
    type: "multiple-choice",
    publicPayload: {
      category: "Patrones",
      tags: {
        domains: ["mathematics", "language_communication"],
        topics: ["letter_patterns"],
        cognitiveSkills: ["logical_reasoning", "pattern_recognition"],
        formatSkills: ["deduction"],
        lifeSkills: [],
      },
      prompt: "Completa la secuencia: A, C, F, J, …",
      context: null,
      timeLimitMs: 10000,
      payload: {
        options: ["M", "N", "O", "P"],
        media: null,
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Los saltos crecen de uno en uno: +2, +3, +4 y +5. Desde J, cinco letras después está la O.",
        payload: {
          correctAnswer: "O",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "australia-capital",
    practicePoints: 100,
    type: "true-false",
    publicPayload: {
      category: "Geografía",
      tags: {
        domains: ["geography"],
        topics: ["capitals"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "Sídney es la capital de Australia.",
      context: null,
      timeLimitMs: 8000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "La capital de Australia es Canberra. Sídney es la ciudad más poblada del país.",
        payload: {
          correctAnswer: false,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "gold-symbol",
    practicePoints: 110,
    type: "short-text",
    publicPayload: {
      category: "Ciencia",
      tags: {
        domains: ["natural_sciences"],
        topics: ["chemistry_elements"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué elemento químico representa el símbolo Au?",
      context: null,
      timeLimitMs: 9000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation: "Au procede de aurum, el nombre latino del oro.",
        payload: {
          correctAnswer: "Oro",
          acceptedAnswers: ["oro"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "italy-flag",
    practicePoints: 100,
    type: "multiple-choice",
    publicPayload: {
      category: "Banderas",
      tags: {
        domains: ["geography", "culture"],
        topics: ["countries_flags"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall", "interpretation"],
        lifeSkills: [],
      },
      prompt: "¿A qué país pertenece esta bandera?",
      context: null,
      timeLimitMs: 8000,
      payload: {
        options: ["Italia", "Irlanda", "México", "Hungría"],
        media: {
          type: "illustration",
          id: "italy-flag",
          alt: "Bandera vertical verde, blanca y roja",
        },
        promptVisual: null,
      },
    },
    privatePayload: {
      solution: {
        explanation: "La bandera de Italia tiene tres franjas verticales: verde, blanca y roja.",
        payload: {
          correctAnswer: "Italia",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "inventions-order",
    practicePoints: 140,
    type: "ordering",
    publicPayload: {
      category: "Historia",
      tags: {
        domains: ["history", "technology"],
        topics: ["inventions"],
        cognitiveSkills: ["memory", "logical_reasoning"],
        formatSkills: ["ordering"],
        lifeSkills: [],
      },
      prompt: "Ordena estos inventos del más antiguo al más reciente.",
      context: null,
      timeLimitMs: 16000,
      payload: {
        items: ["Internet", "Imprenta", "Teléfono", "Máquina de vapor"],
        directionLabels: {
          start: "Más antiguo",
          end: "Más reciente",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La imprenta surgió en el siglo XV, la máquina de vapor se desarrolló en los siglos XVII y XVIII, el teléfono se patentó en el XIX e Internet nació en el XX.",
        payload: {
          correctOrder: ["Imprenta", "Máquina de vapor", "Teléfono", "Internet"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "byte-bits",
    practicePoints: 100,
    type: "true-false",
    publicPayload: {
      category: "Tecnología",
      tags: {
        domains: ["technology", "mathematics"],
        topics: ["computing_units"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: ["digital_literacy"],
      },
      prompt: "Un byte equivale a ocho bits.",
      context: null,
      timeLimitMs: 7000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "Un byte es una unidad de información formada, de manera habitual, por ocho bits.",
        payload: {
          correctAnswer: true,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "red-planet",
    practicePoints: 110,
    type: "short-text",
    publicPayload: {
      category: "Espacio",
      tags: {
        domains: ["natural_sciences"],
        topics: ["astronomy_planets"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
      prompt: "¿Qué planeta es conocido como el planeta rojo?",
      context: null,
      timeLimitMs: 8000,
      payload: null,
    },
    privatePayload: {
      solution: {
        explanation:
          "El óxido de hierro de su superficie da a Marte su característico color rojizo.",
        payload: {
          correctAnswer: "Marte",
          acceptedAnswers: ["marte"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "eiffel-tower",
    practicePoints: 140,
    type: "estimation",
    publicPayload: {
      category: "Lugares",
      tags: {
        domains: ["geography", "culture"],
        topics: ["landmarks"],
        cognitiveSkills: ["quantitative_reasoning"],
        formatSkills: ["estimation"],
        lifeSkills: [],
      },
      prompt: "¿Cuántos metros mide la Torre Eiffel?",
      context: null,
      timeLimitMs: 15000,
      payload: {
        min: 100,
        max: 500,
        step: 10,
        initialValue: 300,
        unit: "m",
        media: {
          type: "image",
          src: "/visuals/connections/eiffel-tower.png",
          alt: "Torre Eiffel junto al río Sena bajo un cielo azul",
          fit: "cover",
          position: "50% 50%",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La Torre Eiffel alcanza 330 metros de altura contando su antena. La estructura original, construida para la Exposición Universal de 1889, medía unos 300 metros.",
        payload: {
          correctAnswer: 330,
          tolerance: 200,
        },
      },
      reveals: [],
    },
  },
  {
    slug: "logic-connection",
    practicePoints: 150,
    type: "logic-code",
    publicPayload: {
      category: "Lógica",
      tags: {
        domains: ["mathematics"],
        topics: ["logic_puzzles"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["deduction"],
        lifeSkills: [],
      },
      prompt: "Deduce el código secreto de tres cifras.",
      context: null,
      timeLimitMs: 25000,
      payload: {
        clues: [
          {
            code: "682",
            hint: "Una cifra es correcta y está bien colocada.",
          },
          {
            code: "614",
            hint: "Una cifra es correcta, pero está mal colocada.",
          },
          {
            code: "206",
            hint: "Dos cifras son correctas, pero están mal colocadas.",
          },
          {
            code: "738",
            hint: "Ninguna cifra es correcta.",
          },
          {
            code: "780",
            hint: "Una cifra es correcta, pero está mal colocada.",
          },
        ],
        codeLength: 3,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "738 descarta 7, 3 y 8. En 780, el 0 es correcto pero no va al final; en 206, el 0 y el 2 son correctos pero están mal colocados. Así, el 0 ocupa la primera posición y el 2 la tercera. La pista 614 confirma que el 4 es correcto pero no va en la tercera posición: el código es 042.",
        payload: {
          correctAnswer: "042",
        },
      },
      reveals: [],
    },
  },
  {
    slug: "living-things-classification",
    practicePoints: 160,
    type: "classification",
    publicPayload: {
      category: "Biología",
      tags: {
        domains: ["natural_sciences"],
        topics: ["biology_taxonomy"],
        cognitiveSkills: ["comprehension"],
        formatSkills: ["classification"],
        lifeSkills: [],
      },
      prompt: "Clasifica cada ser vivo en su grupo.",
      context: null,
      timeLimitMs: 20000,
      payload: {
        items: [
          {
            label: "Cocodrilo",
          },
          {
            label: "Delfín",
          },
          {
            label: "Águila",
          },
          {
            label: "Tortuga",
          },
          {
            label: "Murciélago",
          },
          {
            label: "Pingüino",
          },
          {
            label: "Ballena",
          },
        ],
        categories: ["mamífero", "ave", "reptil"],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Delfines, murciélagos y ballenas son mamíferos; águilas y pingüinos son aves; cocodrilos y tortugas son reptiles.",
        payload: {
          categoriesByItem: {
            Cocodrilo: "reptil",
            Delfín: "mamífero",
            Águila: "ave",
            Tortuga: "reptil",
            Murciélago: "mamífero",
            Pingüino: "ave",
            Ballena: "mamífero",
          },
        },
      },
      reveals: [],
    },
  },
] as const);
