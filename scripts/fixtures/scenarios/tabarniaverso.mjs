export const TABARNIAVERSO_SLUG = "tabarniaverso";

function question({
  slug,
  type,
  timeLimitSeconds,
  category,
  domains,
  topic,
  prompt,
  fields = {},
  solution,
}) {
  const estimation = type === "estimation";
  return {
    slug: `${TABARNIAVERSO_SLUG}-${slug}`,
    type,
    payloadSchemaVersion: estimation ? 2 : 1,
    timeLimitMs: timeLimitSeconds * 1_000,
    publicPayload: {
      category,
      tags: {
        domains,
        topics: [topic],
        cognitiveSkills: [estimation ? "quantitative_reasoning" : "memory"],
        formatSkills: [estimation ? "estimation" : "recall"],
        lifeSkills: [],
      },
      question: prompt,
      ...fields,
    },
    solutionPayload: solution,
  };
}

function multipleChoice({ options, correctIndex, explanation, ...content }) {
  return question({
    ...content,
    type: "multiple-choice",
    fields: { options, media: null, promptVisual: null },
    solution: { correctAnswer: options[correctIndex], explanation },
  });
}

const questions = [
  multipleChoice({
    slug: "assassins-creed",
    timeLimitSeconds: 20,
    category: "Videojuegos",
    domains: ["media_entertainment"],
    topic: "video_games",
    prompt: "¿Quiénes fueron los «padres» de la saga Assassin’s Creed?",
    options: [
      "Jean Guesdon y Andrée-Anne Boisvert",
      "Patrice Désilets y Jade Raymond",
      "Raphaël Lacoste e Isabelle Gagnon",
      "Neil Druckmann y Caroline Miousse",
    ],
    correctIndex: 1,
    explanation:
      "Patrice Désilets fue el director creativo y Jade Raymond la productora del primer Assassin’s Creed, lanzado en 2007.",
  }),
  multipleChoice({
    slug: "edging",
    timeLimitSeconds: 20,
    category: "Sexualidad",
    domains: ["natural_sciences"],
    topic: "human_anatomy",
    prompt: "¿En qué consiste la práctica conocida como edging?",
    options: [
      "Mantener el mismo ritmo de estimulación hasta llegar al orgasmo.",
      "Acercarse al orgasmo y reducir o pausar la estimulación para retrasarlo.",
      "Limitar el contacto sexual a caricias sin penetración.",
      "Aumentar el ritmo de la estimulación para llegar antes al orgasmo.",
    ],
    correctIndex: 1,
    explanation: "El edging consiste en retrasar deliberadamente el orgasmo.",
  }),
  multipleChoice({
    slug: "kirlia",
    timeLimitSeconds: 18,
    category: "Videojuegos",
    domains: ["media_entertainment"],
    topic: "video_games",
    prompt: "¿Qué requisito debe cumplir Kirlia para evolucionar a Gallade?",
    options: [
      "Una Piedra Solar.",
      "Que tenga pito.",
      "Conocer un movimiento de tipo lucha.",
      "Tener el nivel de amistad al máximo.",
    ],
    correctIndex: 1,
    explanation: "La Piedra Alba permite evolucionar a Gallade a un Kirlia macho.",
  }),
  question({
    slug: "capas-atmosfera",
    timeLimitSeconds: 22,
    type: "ordering",
    category: "Ciencias naturales",
    domains: ["natural_sciences"],
    topic: "weather",
    prompt:
      "Ordena estas capas desde la más cercana a la superficie terrestre hasta la más lejana.",
    fields: {
      items: ["Mesosfera", "Troposfera", "Termosfera", "Estratosfera"],
      directionLabels: { start: "Más cercana", end: "Más lejana" },
    },
    solution: {
      correctOrder: ["Troposfera", "Estratosfera", "Mesosfera", "Termosfera"],
      explanation:
        "Desde la superficie hacia arriba, la troposfera da paso a la estratosfera, la mesosfera y la termosfera.",
    },
  }),
  question({
    slug: "ocarina-of-time",
    timeLimitSeconds: 16,
    type: "estimation",
    category: "Videojuegos",
    domains: ["media_entertainment"],
    topic: "video_games",
    prompt:
      "¿Con qué nota sobre 100 debutó en Metacritic el remake de The Legend of Zelda: Ocarina of Time para Nintendo Switch 2?",
    fields: { min: 80, max: 100, step: 1, initialValue: 90, unit: "/100", media: null },
    solution: {
      correctAnswer: 96,
      tolerance: 4,
      explanation: "La edición de Nintendo Switch 2 debutó con un Metascore de 96 sobre 100.",
    },
  }),
  multipleChoice({
    slug: "mateo",
    timeLimitSeconds: 14,
    category: "Biblia",
    domains: ["culture", "language_communication"],
    topic: "vocabulary",
    prompt: "Completa Mateo 21:17\n«Y dejándolos, salió fuera de la ciudad, a _____, y posó allí».",
    options: ["Betfagé", "Jericó", "Betania", "Belén"],
    correctIndex: 2,
    explanation: "Según Mateo 21:17, Jesús salió de la ciudad y pasó la noche en Betania.",
  }),
  multipleChoice({
    slug: "interstellar",
    timeLimitSeconds: 14,
    category: "Cine",
    domains: ["media_entertainment"],
    topic: "cinema",
    prompt:
      "En Interstellar, ¿cómo se llamaba el planeta en cuya superficie una hora equivalía a unos siete años en la Tierra?",
    options: ["Edmunds", "Cooper", "Miller", "Mann"],
    correctIndex: 2,
    explanation:
      "El planeta de Miller orbita cerca de Gargantúa, donde el tiempo pasa más despacio.",
  }),
  question({
    slug: "scorsese",
    timeLimitSeconds: 12,
    type: "true-false",
    category: "Cine",
    domains: ["media_entertainment"],
    topic: "cinema",
    prompt:
      "Hasta la gala de 2026, Martin Scorsese había ganado un solo Óscar a la mejor dirección.",
    solution: {
      correctAnswer: true,
      explanation: "Lo ganó en 2007 por Infiltrados (The Departed).",
    },
  }),
  question({
    slug: "figuras-mitologicas",
    timeLimitSeconds: 25,
    type: "matching",
    category: "Mitología",
    domains: ["culture", "language_communication"],
    topic: "vocabulary",
    prompt: "Empareja cada figura con su tradición mitológica.",
    fields: {
      leftItems: [
        { id: "fenrir", label: "Fenrir" },
        { id: "anubis", label: "Anubis" },
        { id: "cerbero", label: "Cerbero" },
        { id: "quetzalcoatl", label: "Quetzalcóatl" },
      ],
      rightItems: [
        { id: "griega", label: "Griega" },
        { id: "mexica", label: "Mexica" },
        { id: "nordica", label: "Nórdica" },
        { id: "egipcia", label: "Egipcia" },
      ],
    },
    solution: {
      matches: { fenrir: "nordica", anubis: "egipcia", cerbero: "griega", quetzalcoatl: "mexica" },
      explanation:
        "Fenrir es un lobo de la mitología nórdica, Anubis es un dios egipcio, Cerbero guarda el inframundo griego y Quetzalcóatl es la serpiente emplumada de la tradición mexica.",
    },
  }),
  multipleChoice({
    slug: "formula-1",
    timeLimitSeconds: 20,
    category: "Deportes",
    domains: ["sports", "geography"],
    topic: "landmarks",
    prompt:
      "¿A qué circuito prohibió la FIA organizar más carreras de Fórmula 1 tras un incidente en la ceremonia del podio del Gran Premio de Europa de 1997?",
    options: ["Circuito de Estoril", "Circuito de Jerez", "Nürburgring", "Donington Park"],
    correctIndex: 1,
    explanation:
      "La FIA vetó al circuito de Jerez por la intervención de autoridades locales en el podio y levantó la sanción en marzo de 1998.",
  }),
  question({
    slug: "capital-australia",
    timeLimitSeconds: 16,
    type: "short-text",
    category: "Geografía",
    domains: ["geography"],
    topic: "capitals",
    prompt: "¿Cuál es la capital de Australia?",
    solution: {
      correctAnswer: "Canberra",
      acceptedAnswers: ["Canberra"],
      explanation: "Canberra es la capital federal de Australia.",
    },
  }),
  multipleChoice({
    slug: "escala-mayor",
    timeLimitSeconds: 20,
    category: "Música",
    domains: ["music", "language_communication"],
    topic: "vocabulary",
    prompt:
      "¿Cuántos intervalos de un semitono hay entre notas consecutivas de una escala mayor, contando hasta la octava?",
    options: ["Uno", "Dos", "Tres", "Cuatro"],
    correctIndex: 1,
    explanation:
      "Hay dos semitonos, entre los grados tercero y cuarto y entre el séptimo y la octava.",
  }),
  multipleChoice({
    slug: "pokemon-sega-pico",
    timeLimitSeconds: 18,
    category: "Videojuegos",
    domains: ["media_entertainment"],
    topic: "video_games",
    prompt:
      "¿Cuál de estos juegos de Pokémon se lanzó en exclusiva para la consola educativa Sega Pico?",
    options: [
      "Pokémon Dash",
      "Pokémon Puzzle League",
      "Pokémon Link: Battle!",
      "Pokémon: Catch the Numbers!",
    ],
    correctIndex: 3,
    explanation:
      "Pokémon: Catch the Numbers! se publicó en Japón en 2002 para Sega Pico y enseñaba a contar mediante minijuegos.",
  }),
  question({
    slug: "intruso-van-gogh",
    timeLimitSeconds: 20,
    type: "odd-one-out",
    category: "Pintura",
    domains: ["art_design", "language_communication"],
    topic: "vocabulary",
    prompt: "Tres de estas obras son de Vincent van Gogh. ¿Cuál es la intrusa?",
    fields: {
      items: [
        { id: "noche-estrellada", label: "La noche estrellada" },
        { id: "el-grito", label: "El grito" },
        { id: "comedores-patatas", label: "Los comedores de patatas" },
        { id: "habitacion-arles", label: "La habitación de Arlés" },
      ],
    },
    solution: {
      correctAnswer: "el-grito",
      explanation:
        "El grito es obra de Edvard Munch. Las otras tres obras son de Vincent van Gogh.",
    },
  }),
  question({
    slug: "petra",
    timeLimitSeconds: 30,
    type: "progressive-clues",
    category: "Patrimonio",
    domains: ["culture", "geography"],
    topic: "landmarks",
    prompt: "¿Qué ciudad antigua buscamos?",
    fields: {
      clues: [
        "Fue la capital del reino nabateo.",
        "Sus ruinas se encuentran en la actual Jordania.",
        "Uno de sus monumentos, tallado en la roca, se conoce como «El Tesoro».",
      ],
      cluePenalty: 1,
    },
    solution: {
      correctAnswer: "Petra",
      acceptedAnswers: ["Petra"],
      explanation:
        "Petra fue la capital de los nabateos y allí se encuentra el monumento conocido como «El Tesoro».",
    },
  }),
  question({
    slug: "quimica-cotidiana",
    timeLimitSeconds: 30,
    type: "classification",
    category: "Química",
    domains: ["natural_sciences"],
    topic: "chemistry_elements",
    prompt: "Clasifica cada sustancia como elemento, compuesto o mezcla.",
    fields: {
      items: [
        { label: "Aire" },
        { label: "Hierro" },
        { label: "Agua destilada" },
        { label: "Helio" },
        { label: "Agua de mar" },
        { label: "Dióxido de carbono" },
      ],
      categories: ["elemento", "compuesto", "mezcla"],
    },
    solution: {
      categoriesByItem: {
        Aire: "mezcla",
        Hierro: "elemento",
        "Agua destilada": "compuesto",
        Helio: "elemento",
        "Agua de mar": "mezcla",
        "Dióxido de carbono": "compuesto",
      },
      explanation:
        "El hierro y el helio son elementos. El agua destilada y el dióxido de carbono son compuestos. El aire y el agua de mar son mezclas.",
    },
  }),
];

const pointsPerQuestion = Math.floor(100 / questions.length);
const extraPoints = 100 % questions.length;

export const TABARNIAVERSO_QUESTIONS = questions.map((question, index) => ({
  ...question,
  points: pointsPerQuestion + (index < extraPoints ? 1 : 0),
}));
