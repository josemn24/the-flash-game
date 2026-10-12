const tags = {
  domains: ["history", "culture", "language_communication"],
  topics: ["landmarks", "vocabulary"],
  cognitiveSkills: ["memory", "comprehension", "logical_reasoning"],
  formatSkills: ["recall", "comparison", "deduction", "ordering", "classification", "planning"],
  lifeSkills: [],
};

const pointsByType = {
  matching: 10,
  "progressive-clues": 12,
  ordering: 13,
  "mini-wordle": 14,
  "word-search": 15,
  classification: 17,
  "word-hashtag": 19,
};

function question(slug, type, prompt, timeLimitMs, payload, solutionPayload) {
  return {
    slug,
    type,
    points: pointsByType[type],
    timeLimitMs,
    payloadSchemaVersion: 1,
    publicPayload: {
      category: "Ecos de la Antigüedad",
      tags,
      question: prompt,
      ...payload,
    },
    solutionPayload,
  };
}

export const BETA_VIP_ANTIQUITY = {
  slug: "betavip-ecos-de-la-antiguedad",
  title: "Ecos de la Antigüedad",
  subtitle: "Siete niveles entre cuatro civilizaciones",
  description:
    "Recorre Egipto, Mesopotamia, Grecia y Roma a través de sus monumentos, personajes, cronologías y conceptos.",
  modeConfig: {},
};

const wordSearchLetters = [
  "TUTANKAMON",
  "PUCLHHNTTA",
  "RFCESARBHU",
  "AFRVXHOJXG",
  "MATWPPWEQU",
  "SXDHQRUIZS",
  "EGTJTKKHHT",
  "SAJTCTIBGO",
  "LDIJUTNRQH",
  "ZSOCRATESZ",
].flatMap((row) => Array.from(row));

export const betaVipAntiquityQuestions = [
  question(
    "betavip-ecos-antiguedad-emparejamiento",
    "matching",
    "Relaciona cada monumento con la civilización que lo construyó.",
    18_000,
    {
      leftItems: [
        { id: "giza", label: "Gran Pirámide de Guiza" },
        { id: "ur", label: "Zigurat de Ur" },
        { id: "parthenon", label: "Partenón" },
        { id: "colosseum", label: "Coliseo" },
      ],
      rightItems: [
        { id: "rome", label: "Roma" },
        { id: "greece", label: "Grecia" },
        { id: "egypt", label: "Egipto" },
        { id: "mesopotamia", label: "Mesopotamia" },
      ],
    },
    {
      matches: {
        giza: "egypt",
        ur: "mesopotamia",
        parthenon: "greece",
        colosseum: "rome",
      },
      explanation:
        "La Gran Pirámide pertenece a Egipto, el zigurat de Ur a Mesopotamia, el Partenón a Grecia y el Coliseo a Roma.",
    },
  ),
  question(
    "betavip-ecos-antiguedad-cleopatra",
    "progressive-clues",
    "¿Quién gobernó Egipto?",
    35_000,
    {
      clues: [
        "Goberné Egipto desde Alejandría.",
        "Tuve alianzas con Julio César y Marco Antonio.",
        "Fui la última gobernante del Egipto ptolemaico.",
      ],
      cluePenalty: 20,
    },
    {
      correctAnswer: "Cleopatra",
      acceptedAnswers: ["Cleopatra", "Cleopatra VII"],
      explanation:
        "Cleopatra VII gobernó Egipto desde Alejandría y sus alianzas con Julio César y Marco Antonio marcaron el final del reino ptolemaico.",
    },
  ),
  question(
    "betavip-ecos-antiguedad-momia",
    "mini-wordle",
    "Descubre una palabra de cinco letras relacionada con los ritos funerarios egipcios.",
    55_000,
    {
      wordLength: 5,
      maxAttempts: 6,
    },
    {
      correctAnswer: "MOMIA",
      dictionaryId: "es-general-5.v1",
      additionalGuesses: ["MOMIO"],
      explanation: "La momificación conservaba el cuerpo y daba lugar a la momia.",
    },
  ),
  question(
    "betavip-ecos-antiguedad-cronologia",
    "ordering",
    "Ordena estos hitos de la Antigüedad del más antiguo al más reciente.",
    30_000,
    {
      items: [
        "Inauguración del Coliseo",
        "Construcción del Partenón",
        "Estela de Hammurabi",
        "Construcción de la Gran Pirámide de Guiza",
      ],
      directionLabels: { start: "Más antiguo", end: "Más reciente" },
    },
    {
      correctOrder: [
        "Construcción de la Gran Pirámide de Guiza",
        "Estela de Hammurabi",
        "Construcción del Partenón",
        "Inauguración del Coliseo",
      ],
      explanation:
        "La Gran Pirámide precede a la estela de Hammurabi; después se construyó el Partenón y, más tarde, se inauguró el Coliseo.",
    },
  ),
  question(
    "betavip-ecos-antiguedad-sopa",
    "word-search",
    "Encuentra cinco personajes conocidos de la Antigüedad ocultos en la cuadrícula.",
    60_000,
    {
      grid: { rows: 10, columns: 10 },
      letters: wordSearchLetters,
      targets: [
        { id: "tutankamon", word: "TUTANKAMON" },
        { id: "ramses", word: "RAMSES" },
        { id: "cesar", word: "CESAR" },
        { id: "augusto", word: "AUGUSTO" },
        { id: "socrates", word: "SOCRATES" },
      ],
    },
    {
      positionsByTargetId: {
        tutankamon: { startCell: 0, endCell: 9 },
        ramses: { startCell: 20, endCell: 70 },
        cesar: { startCell: 22, endCell: 26 },
        augusto: { startCell: 19, endCell: 79 },
        socrates: { startCell: 91, endCell: 98 },
      },
      explanation:
        "Tutankamón, Ramsés, César, Augusto y Sócrates aparecen en horizontal o vertical.",
    },
  ),
  question(
    "betavip-ecos-antiguedad-civilizaciones",
    "classification",
    "Clasifica cada elemento según la civilización con la que se asocia principalmente.",
    50_000,
    {
      items: [
        { label: "Pirámides" },
        { label: "Ágora" },
        { label: "Latín" },
        { label: "Cuneiforme" },
        { label: "Partenón" },
        { label: "Zigurats" },
        { label: "Jeroglíficos" },
        { label: "Acueductos" },
      ],
      categories: ["Egipto", "Mesopotamia", "Grecia", "Roma"],
    },
    {
      categoriesByItem: {
        Jeroglíficos: "Egipto",
        Cuneiforme: "Mesopotamia",
        Ágora: "Grecia",
        Acueductos: "Roma",
        Pirámides: "Egipto",
        Zigurats: "Mesopotamia",
        Partenón: "Grecia",
        Latín: "Roma",
      },
      explanation:
        "Los jeroglíficos y pirámides se asocian a Egipto; el cuneiforme y los zigurats, a Mesopotamia; el ágora y el Partenón, a Grecia; el latín y los acueductos, a Roma.",
    },
  ),
  question(
    "betavip-ecos-antiguedad-hashtag",
    "word-hashtag",
    "Intercambia las letras para formar cuatro palabras",
    45_000,
    {
      grid: { rows: 5, columns: 5 },
      initialLetters: [
        null,
        "L",
        null,
        "L",
        null,
        "A",
        "H",
        "E",
        "D",
        "R",
        null,
        "S",
        null,
        "C",
        null,
        "G",
        "E",
        "I",
        "N",
        "O",
        null,
        "S",
        null,
        "T",
        null,
      ],
      maxMoves: 7,
    },
    {
      words: { top: "HADES", bottom: "CENIT", left: "LARES", right: "LEGIO" },
      explanation:
        "HADES y CENIT se leen en horizontal; LARES y LEGIO, en vertical. Los cruces comparten las mismas letras.",
    },
  ),
].map((item, index) => ({ ...item, position: index + 1 }));
