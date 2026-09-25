import { defineQuestionCatalog } from "@/data/mock/catalog/questions/definition";

export const abrahamicQuestions = defineQuestionCatalog([
  {
    slug: "abrahamic-matching-biblical-associations",
    practicePoints: 100,
    type: "matching",
    publicPayload: {
      category: "Biblia y religiones abrahámicas",
      tags: {
        domains: ["culture", "language_communication"],
        topics: ["vocabulary"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["recall", "comparison"],
        lifeSkills: [],
      },
      prompt: "Relaciona cada personaje bíblico con su asociación más conocida.",
      context: null,
      timeLimitMs: 15000,
      payload: {
        leftItems: [
          {
            id: "noe",
            label: "Noé",
          },
          {
            id: "moises",
            label: "Moisés",
          },
          {
            id: "david",
            label: "David",
          },
          {
            id: "jesus",
            label: "Jesús",
          },
        ],
        rightItems: [
          {
            id: "goliat",
            label: "Goliat",
          },
          {
            id: "arca",
            label: "Arca",
          },
          {
            id: "nazaret",
            label: "Nazaret",
          },
          {
            id: "exodo",
            label: "Éxodo",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation: "Noé se asocia al arca, Moisés al Éxodo, David a Goliat y Jesús a Nazaret.",
        payload: {
          matches: {
            noe: "arca",
            moises: "exodo",
            david: "goliat",
            jesus: "nazaret",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "abrahamic-progressive-abraham",
    practicePoints: 100,
    type: "progressive-clues",
    publicPayload: {
      category: "Biblia y religiones abrahámicas",
      tags: {
        domains: ["culture", "language_communication"],
        topics: ["vocabulary"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["recall", "deduction"],
        lifeSkills: [],
      },
      prompt: "¿Qué personaje bíblico soy?",
      context: null,
      timeLimitMs: 35000,
      payload: {
        clueCount: 4,
        cluePenalty: 20,
      },
    },
    privatePayload: {
          solution: {
            explanation:
          "Abraham es una figura de referencia del judaísmo y el cristianismo; Ibrahim es su nombre en árabe y la denominación habitual en el islam.",
        payload: {
          correctAnswer: "Abraham",
          acceptedAnswers: ["Abraham", "Ibrahim"],
        },
      },
      reveals: [
        {
          clueIndex: 0,
          clue: "Mi historia aparece tanto en la Biblia como en el Corán.",
        },
        {
          clueIndex: 1,
          clue: "Soy considerado un patriarca y una figura de referencia para varias tradiciones.",
        },
        {
          clueIndex: 2,
          clue: "Dios estableció conmigo una alianza y me prometió una gran descendencia.",
        },
        {
          clueIndex: 3,
          clue: "En la tradición islámica también se me conoce como Ibrahim.",
        },
      ],
    },
  },
  {
    slug: "abrahamic-order-torah-books",
    practicePoints: 100,
    type: "ordering",
    publicPayload: {
      category: "Biblia y religiones abrahámicas",
      tags: {
        domains: ["culture", "language_communication"],
        topics: ["vocabulary"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["ordering", "recall"],
        lifeSkills: [],
      },
      prompt: "Ordena los cinco libros de la Torá según su orden tradicional.",
      context: null,
      timeLimitMs: 30000,
      payload: {
        items: ["Números", "Génesis", "Deuteronomio", "Éxodo", "Levítico"],
        directionLabels: {
          start: "Primero",
          end: "Último",
        },
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La Torá o Pentateuco comienza con Génesis y continúa con Éxodo, Levítico, Números y Deuteronomio.",
        payload: {
          correctOrder: ["Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio"],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "abrahamic-mini-wordle-josue",
    practicePoints: 100,
    type: "mini-wordle",
    publicPayload: {
      category: "Biblia y religiones abrahámicas",
      tags: {
        domains: ["culture", "language_communication"],
        topics: ["vocabulary", "spelling"],
        cognitiveSkills: ["logical_reasoning", "memory"],
        formatSkills: ["deduction", "recall"],
        lifeSkills: [],
      },
      prompt: "Descubre un personaje bíblico de cinco letras.",
      context: null,
      timeLimitMs: 55000,
      payload: {
        hint: null,
        wordLength: 5,
        maxAttempts: 6,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Josué sucedió a Moisés en el relato bíblico. La solución acepta JOSUE y JOSUÉ mediante normalización de tildes.",
          payload: {
            correctAnswer: "JOSUÉ",
            dictionaryId: "es-general-5.v1",
            additionalGuesses: [
            "AARON",
            "ANGEL",
            "ALTAR",
            "AYUNO",
            "BABEL",
            "BELEN",
            "CALEB",
            "CORAN",
            "CREDO",
            "CULTO",
            "DAVID",
            "ELIAS",
            "ESTER",
            "ISLAM",
            "ISAAC",
            "JACOB",
            "JESUS",
            "JONAS",
            "JUDEA",
            "LUCAS",
            "MARIA",
            "MATEO",
            "PABLO",
            "PACTO",
            "PEDRO",
            "PESAJ",
            "REZAR",
            "SALMO",
            "SAULO",
            "SANTO",
            "SINAI",
            "TAMAR",
            "TORAH",
            "YUSUF",
          ],
        },
      },
      reveals: [],
    },
  },
  {
    slug: "abrahamic-word-search-biblical-characters",
    practicePoints: 100,
    type: "word-search",
    publicPayload: {
      category: "Biblia y religiones abrahámicas",
      tags: {
        domains: ["culture", "language_communication"],
        topics: ["vocabulary"],
        cognitiveSkills: ["pattern_recognition", "memory"],
        formatSkills: ["comparison"],
        lifeSkills: [],
      },
      prompt: "Encuentra los seis personajes bíblicos ocultos en la cuadrícula.",
      context: null,
      timeLimitMs: 60000,
      payload: {
        grid: {
          rows: 8,
          columns: 8,
        },
        letters: [
          "F",
          "W",
          "N",
          "E",
          "C",
          "E",
          "C",
          "I",
          "H",
          "C",
          "J",
          "P",
          "S",
          "M",
          "V",
          "G",
          "Y",
          "A",
          "Q",
          "A",
          "E",
          "T",
          "O",
          "G",
          "H",
          "A",
          "V",
          "C",
          "C",
          "D",
          "E",
          "U",
          "R",
          "S",
          "E",
          "J",
          "Y",
          "O",
          "R",
          "R",
          "J",
          "I",
          "I",
          "U",
          "E",
          "D",
          "B",
          "O",
          "G",
          "K",
          "J",
          "U",
          "D",
          "A",
          "S",
          "V",
          "F",
          "H",
          "L",
          "S",
          "U",
          "S",
          "E",
          "J",
        ],
        targets: [
          {
            id: "isaac",
            word: "ISAAC",
          },
          {
            id: "jacob",
            word: "JACOB",
          },
          {
            id: "ester",
            word: "ESTER",
          },
          {
            id: "jesus",
            word: "JESUS",
          },
          {
            id: "judas",
            word: "JUDAS",
          },
          {
            id: "pedro",
            word: "PEDRO",
          },
        ],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "ISAAC aparece en vertical invertida, JACOB y PEDRO en diagonal, ESTER en diagonal, JESUS en horizontal invertida y JUDAS en horizontal.",
        payload: {
          positionsByTargetId: {
            isaac: {
              startCell: 41,
              endCell: 9,
            },
            jacob: {
              startCell: 10,
              endCell: 46,
            },
            ester: {
              startCell: 3,
              endCell: 39,
            },
            jesus: {
              startCell: 63,
              endCell: 59,
            },
            judas: {
              startCell: 50,
              endCell: 54,
            },
            pedro: {
              startCell: 11,
              endCell: 47,
            },
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "abrahamic-word-hashtag-references",
    practicePoints: 100,
    type: "word-hashtag",
    publicPayload: {
      category: "Biblia y religiones abrahámicas",
      tags: {
        domains: ["culture", "language_communication"],
        topics: ["vocabulary", "spelling"],
        cognitiveSkills: ["logical_reasoning", "problem_solving"],
        formatSkills: ["deduction", "planning"],
        lifeSkills: [],
      },
      prompt: "Completa cuatro palabras bíblicas de cinco letras.",
      context: null,
      timeLimitMs: 45000,
      payload: {
        grid: {
          rows: 5,
          columns: 5,
        },
        initialLetters: [
          null,
          "T",
          null,
          "A",
          null,
          "H",
          "A",
          "P",
          "B",
          "L",
          null,
          "R",
          null,
          "O",
          null,
          "T",
          "O",
          "B",
          "A",
          "T",
          null,
          "R",
          null,
          "R",
          null,
        ],
        maxMoves: 7,
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "Cinco intercambios encadenados colocan PABLO y TORAH en horizontal, y TABOR y ALTAR en vertical.",
        payload: {
          words: {
            top: "PABLO",
            bottom: "TORAH",
            left: "TABOR",
            right: "ALTAR",
          },
        },
      },
      reveals: [],
    },
  },
  {
    slug: "abrahamic-classification-three-traditions",
    practicePoints: 100,
    type: "classification",
    publicPayload: {
      category: "Biblia y religiones abrahámicas",
      tags: {
        domains: ["culture", "language_communication"],
        topics: ["vocabulary"],
        cognitiveSkills: ["memory", "comprehension"],
        formatSkills: ["classification", "comparison"],
        lifeSkills: [],
      },
      prompt: "Clasifica los elementos por tradición.",
      context: null,
      timeLimitMs: 50000,
      payload: {
        items: [
          {
            label: "Torá",
          },
          {
            label: "Evangelios",
          },
          {
            label: "Pésaj",
          },
          {
            label: "Corán",
          },
          {
            label: "Cruz",
          },
          {
            label: "Ramadán",
          },
          {
            label: "Menorá",
          },
          {
            label: "Navidad",
          },
          {
            label: "Kaaba",
          },
        ],
        categories: ["Judaísmo", "Cristianismo", "Islam"],
      },
    },
    privatePayload: {
      solution: {
        explanation:
          "La Torá, Pésaj y la menorá se asocian principalmente al judaísmo; los Evangelios, la cruz y Navidad al cristianismo; y el Corán, Ramadán y la Kaaba al islam.",
        payload: {
          categoriesByItem: {
            Torá: "Judaísmo",
            Evangelios: "Cristianismo",
            Pésaj: "Judaísmo",
            Corán: "Islam",
            Cruz: "Cristianismo",
            Ramadán: "Islam",
            Menorá: "Judaísmo",
            Navidad: "Cristianismo",
            Kaaba: "Islam",
          },
        },
      },
      reveals: [],
    },
  },
] as const);
