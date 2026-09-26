const timeLimits = {
  "true-false": 9_000,
  "multiple-choice": 10_000,
  matching: 18_000,
  ordering: 16_000,
  "progressive-image": 16_000,
  estimation: 14_000,
  "progressive-clues": 25_000,
};
const topicTags = {
  Cine: { domain: "media_entertainment", topic: "cinema" },
  Series: { domain: "media_entertainment", topic: "television_series" },
  Música: { domain: "music", topic: "popular_music" },
  Videojuegos: { domain: "media_entertainment", topic: "video_games" },
};
const formatSkills = {
  "progressive-clues": "deduction",
  ordering: "ordering",
  estimation: "estimation",
  "progressive-image": "interpretation",
  matching: "comparison",
};

function question(position, topic, type, prompt, publicFields, solutionPayload) {
  const points = position === 1 ? 4 : position === 20 ? 6 : 5;
  return {
    slug: `betavip-pop-culture-${String(position).padStart(2, "0")}`,
    topic,
    type,
    position,
    points,
    timeLimitMs: timeLimits[type],
    payloadSchemaVersion: ["progressive-image", "estimation"].includes(type) ? 2 : 1,
    publicPayload: {
      category: topic,
      tags: {
        domains: [topicTags[topic].domain],
        topics: [topicTags[topic].topic],
        cognitiveSkills: ["memory"],
        formatSkills: [formatSkills[type] ?? "recall"],
        lifeSkills: [],
      },
      question: prompt,
      ...publicFields,
    },
    solutionPayload,
  };
}

function truth(position, topic, prompt, explanation) {
  return question(position, topic, "true-false", prompt, {}, { correctAnswer: true, explanation });
}

function choice(position, topic, prompt, options, correctAnswer, explanation) {
  return question(
    position,
    topic,
    "multiple-choice",
    prompt,
    { options, media: null, promptVisual: null },
    { correctAnswer, explanation },
  );
}

function clues(position, topic, prompt, hints, correctAnswer, acceptedAnswers, explanation) {
  return question(
    position,
    topic,
    "progressive-clues",
    prompt,
    { clues: hints, cluePenalty: 30 },
    { correctAnswer, acceptedAnswers, explanation },
  );
}

function matching(position, topic, prompt, pairs, explanation) {
  const leftItems = pairs.map(([left], index) => ({ id: `left-${index + 1}`, label: left }));
  const rightItems = [pairs[2], pairs[0], pairs[1]].map(([, right], index) => ({
    id: `right-${[3, 1, 2][index]}`,
    label: right,
  }));
  return question(
    position,
    topic,
    "matching",
    prompt,
    { leftItems, rightItems },
    {
      matches: { "left-1": "right-1", "left-2": "right-2", "left-3": "right-3" },
      explanation,
    },
  );
}

function ordering(position, topic, prompt, items, correctOrder, explanation) {
  return question(
    position,
    topic,
    "ordering",
    prompt,
    { items, directionLabels: { start: "Más antiguo", end: "Más reciente" } },
    { correctOrder, explanation },
  );
}

export const BETA_VIP_SURVIVAL = {
  slug: "betavip-pop-culture-survival",
  title: "Supervivencia: Cultura pop",
  subtitle: "20 pruebas, 3 vidas",
  description: "Recorre cine, series, música y videojuegos en veinte pruebas de cultura pop.",
  modeConfig: { lives: 3 },
};

export function betaVipSurvivalQuestions(cassetteAssetId) {
  return [
    truth(
      1,
      "Cine",
      "El DeLorean es la máquina del tiempo de Regreso al futuro.",
      "El DeLorean modificado por Doc Brown sirve como máquina del tiempo en Regreso al futuro.",
    ),
    choice(
      2,
      "Series",
      "¿Cómo se llama la cafetería donde se reúnen los protagonistas de Friends?",
      ["Central Perk", "Luke’s Diner", "Monk’s Café", "The Peach Pit"],
      "Central Perk",
      "El grupo de Friends se reúne habitualmente en Central Perk.",
    ),
    question(
      3,
      "Música",
      "progressive-image",
      "¿Qué soporte de audio aparece en la ilustración?",
      {
        surface: {
          assetId: cassetteAssetId,
          alt: "Fotografía de tres casetes de audio",
          width: 1200,
          height: 800,
          fit: "contain",
        },
        revealDurationMs: 7_000,
        answerLabel: null,
        answerPlaceholder: null,
      },
      {
        correctAnswer: "casete",
        acceptedAnswers: ["casete", "caset", "cassette", "cinta de casete"],
        solutionAlt: "Fotografía de tres casetes de audio",
        explanation: "El casete almacena audio en una cinta magnética entre dos carretes.",
      },
    ),
    truth(
      4,
      "Videojuegos",
      "En Tetris se completan líneas horizontales con piezas que caen.",
      "En Tetris las piezas caen y las líneas horizontales completas desaparecen.",
    ),
    clues(
      5,
      "Cine",
      "¿Qué director une estas películas?",
      [
        "Dirigió una película sobre un tiburón que amenaza una playa.",
        "También dirigió E.T., el extraterrestre.",
        "Dirigió Jurassic Park.",
      ],
      "Steven Spielberg",
      ["Steven Spielberg", "Spielberg"],
      "Steven Spielberg dirigió Tiburón, E.T. y Jurassic Park.",
    ),
    matching(
      6,
      "Series",
      "Empareja cada serie con su ciudad ficticia o real.",
      [
        ["Stranger Things", "Hawkins"],
        ["Los Simpson", "Springfield"],
        ["The Office (EE. UU.)", "Scranton"],
      ],
      "Stranger Things sucede en Hawkins, Los Simpson en Springfield y The Office (EE. UU.) en Scranton.",
    ),
    matching(
      7,
      "Música",
      "Empareja cada intérprete con su canción.",
      [
        ["Michael Jackson", "Thriller"],
        ["Shakira", "Waka Waka"],
        ["Adele", "Rolling in the Deep"],
      ],
      "Thriller es de Michael Jackson, Waka Waka de Shakira y Rolling in the Deep de Adele.",
    ),
    matching(
      8,
      "Videojuegos",
      "Empareja cada personaje con su saga.",
      [
        ["Samus Aran", "Metroid"],
        ["Master Chief", "Halo"],
        ["Lara Croft", "Tomb Raider"],
      ],
      "Samus protagoniza Metroid; Master Chief, Halo; y Lara Croft, Tomb Raider.",
    ),
    choice(
      9,
      "Cine",
      "¿En qué película Miguel visita el mundo de los muertos?",
      ["Coco", "Soul", "Encanto", "Luca"],
      "Coco",
      "Miguel visita el mundo de los muertos en Coco.",
    ),
    clues(
      10,
      "Series",
      "¿De qué serie se trata?",
      [
        "La historia transcurre principalmente en Albuquerque.",
        "Su protagonista es profesor de química.",
        "Adopta el alias Heisenberg.",
      ],
      "Breaking Bad",
      ["Breaking Bad"],
      "Walter White, profesor de química en Albuquerque, adopta el alias Heisenberg en Breaking Bad.",
    ),
    question(
      11,
      "Música",
      "estimation",
      "¿En qué año se publicó el álbum Thriller de Michael Jackson?",
      {
        min: 1970,
        max: 1995,
        step: 1,
        initialValue: 1980,
        unit: "año",
        media: null,
      },
      {
        correctAnswer: 1982,
        tolerance: 2,
        explanation: "Thriller se publicó en 1982; se aceptan años entre 1980 y 1984.",
      },
    ),
    choice(
      12,
      "Videojuegos",
      "¿Cómo se llama el reino de The Legend of Zelda: Breath of the Wild?",
      ["Hyrule", "Midgar", "Azeroth", "Rivia"],
      "Hyrule",
      "Breath of the Wild se desarrolla en Hyrule.",
    ),
    ordering(
      13,
      "Cine",
      "Ordena estas películas por año de estreno, de la más antigua a la más reciente.",
      ["Avatar", "Titanic", "Regreso al futuro", "Star Wars (1977)"],
      ["Star Wars (1977)", "Regreso al futuro", "Titanic", "Avatar"],
      "Se estrenaron en 1977, 1985, 1997 y 2009, respectivamente.",
    ),
    clues(
      14,
      "Música",
      "¿Qué artista une estas pistas?",
      ["Formó parte de Destiny’s Child.", "Cantó Single Ladies.", "Publicó el álbum Renaissance."],
      "Beyoncé",
      ["Beyoncé"],
      "Beyoncé formó parte de Destiny’s Child, cantó Single Ladies y publicó Renaissance.",
    ),
    truth(
      15,
      "Series",
      "Las máscaras de La casa de papel están inspiradas en Salvador Dalí.",
      "Los atracadores de La casa de papel llevan máscaras inspiradas en Salvador Dalí.",
    ),
    ordering(
      16,
      "Videojuegos",
      "Ordena estas consolas por su lanzamiento original, de la más antigua a la más reciente.",
      ["Wii", "NES", "Nintendo Switch", "PlayStation"],
      ["NES", "PlayStation", "Wii", "Nintendo Switch"],
      "NES llegó antes que PlayStation; después salieron Wii y Nintendo Switch.",
    ),
    matching(
      17,
      "Cine",
      "Empareja cada saga o película con su objeto emblemático.",
      [
        ["Star Wars", "sable láser"],
        ["Harry Potter", "varita"],
        ["Regreso al futuro", "DeLorean"],
      ],
      "El sable láser es de Star Wars, la varita de Harry Potter y el DeLorean de Regreso al futuro.",
    ),
    clues(
      18,
      "Videojuegos",
      "¿Cómo se llama la primera entrega de este videojuego?",
      [
        "La acción ocurre en las instalaciones de Aperture Science.",
        "Una inteligencia artificial llamada GLaDOS guía las pruebas.",
        "Usas un dispositivo que abre accesos entre paredes.",
      ],
      "Portal",
      ["Portal"],
      "Portal es la primera entrega ambientada en Aperture Science con GLaDOS.",
    ),
    choice(
      19,
      "Música",
      "¿Qué grupo grabó Bohemian Rhapsody?",
      ["Queen", "ABBA", "The Beatles", "U2"],
      "Queen",
      "Bohemian Rhapsody es una canción del grupo Queen.",
    ),
    ordering(
      20,
      "Series",
      "Ordena estas series por su primer estreno, de la más antigua a la más reciente.",
      ["The Last of Us", "Friends", "Stranger Things", "Breaking Bad"],
      ["Friends", "Breaking Bad", "Stranger Things", "The Last of Us"],
      "Friends empezó en 1994, Breaking Bad en 2008, Stranger Things en 2016 y The Last of Us en 2023.",
    ),
  ];
}
