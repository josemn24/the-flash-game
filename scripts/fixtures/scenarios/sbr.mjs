import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { removeStorageObject, uploadStorageObject } from "../../support/supabase-local.mjs";

const namespace = "the-flash-game:sbr";
const mapPath = path.resolve("public/visuals/sbr/usa-location-map.png");
const assetLabel = "question-asset:sbr-grand-canyon-heat-map";

const tags = (domains, topics, cognitiveSkills, formatSkills, lifeSkills = []) => ({
  domains,
  topics,
  cognitiveSkills,
  formatSkills,
  lifeSkills,
});

const question = ({
  slug,
  type,
  points,
  timeLimitMs,
  publicPayload,
  solutionPayload,
  payloadSchemaVersion = 1,
}) => ({
  slug,
  type,
  points,
  timeLimitMs,
  payloadSchemaVersion,
  publicPayload,
  solutionPayload,
});

const SBR_QUESTIONS = [
  question({
    slug: "sbr-fire-horse-year",
    type: "multiple-choice",
    points: 6,
    timeLimitMs: 18000,
    publicPayload: {
      category: "Cultura",
      tags: tags(["culture", "history"], ["countries_flags"], ["memory"], ["recall"]),
      question:
        "¿Qué cultura celebra en 2026 el Año del Caballo de Fuego, que se repite cada 60 años?",
      options: ["La cultura azteca", "La cultura maya", "La cultura china", "La cultura celta"],
      media: {
        type: "image",
        src: "/visuals/sbr/horse-fire.jpg",
        alt: "Ilustración de un caballo envuelto en llamas sobre un fondo oscuro",
        fit: "cover",
        position: "50% 50%",
      },
      promptVisual: null,
    },
    solutionPayload: {
      correctAnswer: "La cultura china",
      explanation:
        "En el zodiaco chino, 2026 corresponde al Año del Caballo de Fuego dentro del ciclo sexagenario.",
    },
  }),
  question({
    slug: "sbr-equidae-odd-one-out",
    type: "odd-one-out",
    points: 6,
    timeLimitMs: 14000,
    publicPayload: {
      category: "Ciencias naturales",
      tags: tags(["natural_sciences"], ["biology_taxonomy"], ["comprehension"], ["classification"]),
      question: "¿Cuál de estos animales no pertenece a la familia de los équidos?",
      items: [
        { id: "horse", label: "Caballo" },
        { id: "zebra", label: "Cebra" },
        { id: "donkey", label: "Burro" },
        { id: "bison", label: "Bisonte" },
      ],
    },
    solutionPayload: {
      correctAnswer: "bison",
      explanation:
        "Caballos, cebras y burros son équidos. El bisonte pertenece a la familia de los bóvidos.",
    },
  }),
  question({
    slug: "sbr-currency-matching",
    type: "matching",
    points: 7,
    timeLimitMs: 22000,
    publicPayload: {
      category: "Geografía",
      tags: tags(
        ["geography", "economics"],
        ["countries_flags", "personal_finance"],
        ["memory"],
        ["comparison"],
      ),
      question: "Relaciona cada país con su moneda.",
      leftItems: [
        { id: "united-states", label: "Estados Unidos", icon: "🇺🇸" },
        { id: "japan", label: "Japón", icon: "🇯🇵" },
        { id: "mexico", label: "México", icon: "🇲🇽" },
        { id: "spain", label: "España", icon: "🇪🇸" },
      ],
      rightItems: [
        { id: "yen", label: "Yen", icon: "¥" },
        { id: "dollar", label: "Dólar", icon: "$" },
        { id: "peso", label: "Peso", icon: "MX$" },
        { id: "euro", label: "Euro", icon: "€" },
      ],
    },
    solutionPayload: {
      matches: { "united-states": "dollar", japan: "yen", mexico: "peso", spain: "euro" },
      explanation: "Estados Unidos usa el dólar, Japón el yen, México el peso y España el euro.",
    },
  }),
  question({
    slug: "sbr-west-to-east-cities",
    type: "ordering",
    points: 7,
    timeLimitMs: 26000,
    publicPayload: {
      category: "Geografía",
      tags: tags(["geography"], ["maps"], ["logical_reasoning", "memory"], ["ordering"]),
      question: "Ordena estas ciudades de oeste a este.",
      items: ["Nueva York", "Denver", "San Diego", "Chicago"],
      directionLabels: { start: "Más al oeste", end: "Más al este" },
    },
    solutionPayload: {
      correctOrder: ["San Diego", "Denver", "Chicago", "Nueva York"],
      explanation:
        "San Diego está en la costa oeste; Denver queda en las Rocosas, Chicago más al este y Nueva York en la costa atlántica.",
    },
  }),
  question({
    slug: "sbr-grand-canyon-progressive",
    type: "progressive-image",
    points: 7,
    timeLimitMs: 20000,
    publicPayload: {
      category: "Geografía",
      tags: tags(
        ["geography", "culture"],
        ["landmarks"],
        ["memory", "comprehension"],
        ["interpretation", "recall"],
      ),
      question: "¿Qué paisaje aparece en la imagen?",
      surface: {
        src: "/visuals/sbr/grand-canyon-nps.jpg",
        alt: "Fotografía desenfocada de un paisaje rocoso que se revela progresivamente",
        width: 1280,
        height: 853,
        fit: "cover",
        position: "50% 50%",
      },
      revealDurationMs: 11,
      answerLabel: null,
      answerPlaceholder: null,
    },
    solutionPayload: {
      correctAnswer: "Gran Cañón",
      acceptedAnswers: ["Gran Cañón", "Grand Canyon", "El Gran Cañón"],
      solutionAlt: "Fotografía del Gran Cañón con paredes rojizas, sombras profundas y cielo azul.",
      explanation:
        "El paisaje representa el Gran Cañón, una de las formaciones más reconocibles del suroeste de Estados Unidos.",
    },
  }),
  question({
    slug: "sbr-grand-canyon-heat-map",
    type: "heat-map",
    points: 7,
    timeLimitMs: 18000,
    payloadSchemaVersion: 2,
    publicPayload: {
      category: "Geografía",
      tags: tags(
        ["geography"],
        ["maps", "landmarks"],
        ["memory", "problem_solving"],
        ["interpretation"],
      ),
      question: "Marca aproximadamente dónde se encuentra el Gran Cañón en este mapa.",
      surface: {
        assetId: "__SBR_ASSET_ID__",
        alt: "Mapa sin etiquetas de los Estados Unidos continentales con fronteras estatales",
        width: 1859,
        height: 968,
        fit: "contain",
      },
      targetLabel: "Norte de Arizona, zona del Gran Cañón",
    },
    solutionPayload: {
      target: { x: 0.226, y: 0.537 },
      fullCreditRadius: 0.04,
      toleranceRadius: 0.12,
      explanation:
        "El Gran Cañón está en el norte de Arizona, dentro del suroeste de Estados Unidos.",
    },
  }),
  question({
    slug: "sbr-average-speed",
    type: "estimation",
    points: 6,
    timeLimitMs: 22000,
    payloadSchemaVersion: 2,
    publicPayload: {
      category: "Matemáticas",
      tags: tags(
        ["mathematics"],
        ["arithmetic"],
        ["quantitative_reasoning"],
        ["calculation", "estimation"],
      ),
      question: "Un participante recorre 24 km en 40 minutos. ¿Cuál es su velocidad media?",
      min: 10,
      max: 60,
      step: 1,
      initialValue: 30,
      unit: "km/h",
      media: null,
    },
    solutionPayload: {
      correctAnswer: 36,
      tolerance: 18,
      explanation:
        "40 minutos son dos tercios de hora. Recorrer 24 km en dos tercios de hora equivale a 36 km/h.",
    },
  }),
  question({
    slug: "sbr-1890-gear-classification",
    type: "classification",
    points: 6,
    timeLimitMs: 22000,
    publicPayload: {
      category: "Tecnología",
      tags: tags(
        ["technology", "history"],
        ["inventions"],
        ["critical_thinking", "comprehension"],
        ["classification", "comparison"],
        ["digital_literacy"],
      ),
      question: "Clasifica cada objeto según encaje o no en una carrera ambientada en 1890.",
      items: [
        { label: "Brújula" },
        { label: "Telégrafo" },
        { label: "Cantimplora" },
        { label: "Navegador GPS" },
        { label: "Smartphone" },
      ],
      categories: ["útil en 1890", "anacrónico"],
    },
    solutionPayload: {
      categoriesByItem: {
        Brújula: "útil en 1890",
        Telégrafo: "útil en 1890",
        Cantimplora: "útil en 1890",
        "Navegador GPS": "anacrónico",
        Smartphone: "anacrónico",
      },
      explanation:
        "Brújula, telégrafo y cantimplora encajan en el siglo XIX; GPS y smartphone pertenecen a la tecnología moderna.",
    },
  }),
  question({
    slug: "sbr-race-anagram",
    type: "anagram",
    points: 6,
    timeLimitMs: 30000,
    publicPayload: {
      category: "Deporte",
      tags: tags(
        ["language_communication", "sports"],
        ["vocabulary", "spelling"],
        ["problem_solving"],
        ["ordering"],
      ),
      question: "Forma una palabra relacionada con el desafío.",
      tiles: [
        { id: "a", value: "A" },
        { id: "c", value: "C" },
        { id: "r-1", value: "R" },
        { id: "r-2", value: "R" },
        { id: "a-2", value: "A" },
        { id: "e", value: "E" },
        { id: "r-3", value: "R" },
      ],
      hint: null,
    },
    solutionPayload: {
      correctAnswer: "CARRERA",
      explanation: "Las letras se reordenan como CARRERA, una palabra central en Steel Ball Run.",
    },
  }),
  question({
    slug: "sbr-pony-express",
    type: "multiple-choice",
    points: 6,
    timeLimitMs: 16000,
    publicPayload: {
      category: "Historia",
      tags: tags(
        ["history", "technology"],
        ["inventions"],
        ["memory"],
        ["recall"],
        ["communication"],
      ),
      question: "¿Qué transportaba principalmente el Pony Express?",
      options: ["Correo", "Minerales", "Ganado", "Pasajeros"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: {
      correctAnswer: "Correo",
      explanation:
        "El Pony Express fue un servicio de mensajería rápida que transportaba principalmente correo.",
    },
  }),
  question({
    slug: "sbr-horses-sleep-standing",
    type: "true-false",
    points: 6,
    timeLimitMs: 12000,
    publicPayload: {
      category: "Ciencias naturales",
      tags: tags(["natural_sciences"], ["biology_taxonomy"], ["memory"], ["recall"]),
      question: "Los caballos pueden dormir de pie.",
    },
    solutionPayload: {
      correctAnswer: true,
      explanation:
        "Los caballos pueden dormir de pie gracias a un mecanismo de bloqueo en las patas, aunque necesitan tumbarse para fases de sueño profundo.",
    },
  }),
  question({
    slug: "sbr-steel-composition",
    type: "multiple-choice",
    points: 6,
    timeLimitMs: 16000,
    publicPayload: {
      category: "Química",
      tags: tags(["natural_sciences"], ["chemistry_elements"], ["memory"], ["recall"]),
      question: "¿Qué dos elementos forman principalmente el acero?",
      options: ["Hierro y carbono", "Cobre y estaño", "Oro y plata", "Sodio y cloro"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: {
      correctAnswer: "Hierro y carbono",
      explanation:
        "El acero es una aleación compuesta principalmente por hierro con una pequeña proporción de carbono.",
    },
  }),
  question({
    slug: "sbr-horse-gaits",
    type: "ordering",
    points: 6,
    timeLimitMs: 20000,
    publicPayload: {
      category: "Deporte",
      tags: tags(
        ["sports", "natural_sciences"],
        ["biology_taxonomy"],
        ["memory", "logical_reasoning"],
        ["ordering"],
      ),
      question: "Ordena estos movimientos del caballo de menor a mayor velocidad.",
      items: ["Galope", "Paso", "Trote"],
      directionLabels: { start: "Más lento", end: "Más rápido" },
    },
    solutionPayload: {
      correctOrder: ["Paso", "Trote", "Galope"],
      explanation:
        "El paso es el ritmo más lento, el trote es intermedio y el galope es el más rápido.",
    },
  }),
  question({
    slug: "sbr-bernoulli-principle",
    type: "multiple-choice",
    points: 6,
    timeLimitMs: 20000,
    publicPayload: {
      category: "Física",
      tags: tags(
        ["natural_sciences", "media_entertainment"],
        ["weather", "cinema"],
        ["scientific_reasoning", "comprehension"],
        ["interpretation", "recall"],
      ),
      question:
        "Un caballo galopa con viento. Según Bernoulli, ¿qué pasa con el aire que va más rápido sobre su lomo?",
      options: [
        "El aire más rápido ejerce menos presión",
        "El aire se reparte con la misma presión",
        "El viento elimina toda la resistencia",
        "El aire comprimido empuja más hacia abajo",
      ],
      media: null,
      promptVisual: null,
    },
    solutionPayload: {
      correctAnswer: "El aire más rápido ejerce menos presión",
      explanation:
        "El principio de Bernoulli relaciona velocidad y presión en un fluido: cuando el flujo de aire se acelera, la presión disminuye.",
    },
  }),
  question({
    slug: "sbr-overtake-second-trap",
    type: "true-false",
    points: 6,
    timeLimitMs: 12000,
    publicPayload: {
      category: "Lógica",
      tags: tags(
        ["mathematics", "sports"],
        ["logic_puzzles"],
        ["critical_thinking", "logical_reasoning"],
        ["deduction"],
      ),
      question:
        "En una carrera, adelantas al participante que va segundo. Por lo tanto, quedas primero.",
    },
    solutionPayload: {
      correctAnswer: false,
      explanation:
        "Si adelantas al participante que va segundo, ocupas su posición: quedas segundo, no primero.",
    },
  }),
  question({
    slug: "sbr-creator",
    type: "multiple-choice",
    points: 6,
    timeLimitMs: 14000,
    publicPayload: {
      category: "Cultura",
      tags: tags(
        ["media_entertainment", "culture"],
        ["cinema", "popular_music"],
        ["memory"],
        ["recall"],
      ),
      question: "¿Qué mangaka es el autor de Steel Ball Run?",
      options: ["Eiichiro Oda", "Masashi Kishimoto", "Yoshihiro Togashi", "Hirohiko Araki"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: {
      correctAnswer: "Hirohiko Araki",
      explanation: "Steel Ball Run es obra de Hirohiko Araki, autor de JoJo's Bizarre Adventure.",
    },
  }),
];

export { SBR_QUESTIONS };

async function getMapMetadata() {
  const bytes = await readFile(mapPath);
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== "png" || metadata.width !== 1859 || metadata.height !== 968) {
    throw new Error(
      `El asset SBR no tiene el formato esperado: ${metadata.format} ${metadata.width}x${metadata.height}`,
    );
  }
  return {
    byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: metadata.width,
    height: metadata.height,
  };
}

function questionVersionId(stableId, slug) {
  return stableId(`question-version:${slug}`);
}

function challengeItemId(stableId, slug) {
  return stableId(`challenge-item:${slug}`);
}

export const scenario = {
  id: "sbr",
  namespace,
  seedStorageBeforeSql: true,
  users: [
    { label: "superadmin", displayName: "Operador Steel Ball Run" },
    { label: "owner", displayName: "Jugador Steel Ball Run" },
    { label: "spectator", displayName: "Espectador Steel Ball Run" },
  ],
  async buildDomainSql({ accounts, stableId, sqlString, sqlUuid }) {
    const dateStart = "2000-01-01T00:00:00Z";
    const dateEnd = "2999-01-01T00:00:00Z";
    const assetId = stableId(assetLabel);
    const assetMetadata = await getMapMetadata();
    const questions = SBR_QUESTIONS.map((item) => ({
      ...item,
      publicPayload: JSON.parse(
        JSON.stringify(item.publicPayload).replaceAll("__SBR_ASSET_ID__", assetId),
      ),
    }));

    const questionDefinitionsSql = questions
      .map(
        (item) => `
  (${sqlUuid(`question:${item.slug}`)}, ${sqlString(item.slug)}, ${sqlString(accounts.owner.playerId)})`,
      )
      .join(",");
    const questionVersionsSql = questions
      .map(
        (item) => `
  (${sqlUuid(`question-version:${item.slug}`)}, ${sqlUuid(`question:${item.slug}`)}, 1, ${item.payloadSchemaVersion}, 'draft', ${sqlString(item.type)}, ${item.timeLimitMs}, ${sqlString(JSON.stringify(item.publicPayload))}, ${sqlString(accounts.owner.playerId)})`,
      )
      .join(",");
    const solutionsSql = questions
      .map(
        (item) => `
  (${sqlUuid(`question-version:${item.slug}`)}, ${sqlString(JSON.stringify(item.solutionPayload))})`,
      )
      .join(",");
    const challengeItemsSql = questions
      .map(
        (item, index) => `
  (${sqlUuid(`challenge-item:${item.slug}`)}, ${sqlUuid("challenge-version:steel-ball-run-v1")}, ${sqlUuid(`question-version:${item.slug}`)}, ${index + 1}, ${item.points}, 1, '{}')`,
      )
      .join(",");

    return `
begin;
set constraints all deferred;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
insert into public.rooms (id, slug, title, description)
values (${sqlUuid("room:steel-ball-run")}, 'sbr-main', 'Steel Ball Run', 'Carrera, ingenio y reflejos');
insert into public.room_memberships (room_id, player_id, role, status, joined_at)
values
  (${sqlUuid("room:steel-ball-run")}, ${sqlString(accounts.owner.playerId)}, 'owner', 'active', ${sqlString(dateStart)}),
  (${sqlUuid("room:steel-ball-run")}, ${sqlString(accounts.spectator.playerId)}, 'spectator', 'active', ${sqlString(dateStart)});
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (${sqlUuid("season:steel-ball-run")}, ${sqlUuid("room:steel-ball-run")}, 'Steel Ball Run', 'active', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
insert into private.media_assets
  (id, bucket_id, object_path, kind, status, created_by_player_id, mime_type, byte_size, width, height, sha256)
values
  (${sqlString(assetId)}, 'question-assets', ${sqlString(`question-assets/${assetId}.png`)}, 'question-asset', 'ready',
   ${sqlString(accounts.superadmin.playerId)}, 'image/png', ${assetMetadata.byteSize}, ${assetMetadata.width}, ${assetMetadata.height}, ${sqlString(assetMetadata.sha256)});
insert into private.question_definitions (id, slug, created_by_player_id)
values ${questionDefinitionsSql};
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
values ${questionVersionsSql};
insert into private.question_version_solutions (question_version_id, solution_payload)
values ${solutionsSql};
update private.question_versions set status = 'published', published_at = ${sqlString(dateStart)};
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (${sqlUuid("challenge-definition:steel-ball-run")}, 'demo-challenge-definition', ${sqlString(accounts.owner.playerId)});
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (${sqlUuid("challenge-version:steel-ball-run-v1")}, ${sqlUuid("challenge-definition:steel-ball-run")}, 1, 1, 'draft', 'flash',
  'Steel Ball Run', 'Carrera, ingenio y reflejos', 'Dieciséis retos rápidos sin spoilers inspirados en la carrera transcontinental de Steel Ball Run.', 100, '{}', ${sqlString(accounts.owner.playerId)}, null);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values ${challengeItemsSql};
update private.challenge_versions set status = 'published', published_at = ${sqlString(dateStart)}
where id = ${sqlUuid("challenge-version:steel-ball-run-v1")};
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (${sqlUuid("publication:steel-ball-run")}, ${sqlUuid("season:steel-ball-run")}, ${sqlUuid("challenge-version:steel-ball-run-v1")}, 1, 'open', ${sqlString(dateStart)}, ${sqlString(dateEnd)});
set constraints all immediate;
commit;
`;
  },
  async seedStorage({ config, stableId }) {
    await uploadStorageObject(config, {
      bucket: "question-assets",
      objectPath: `question-assets/${stableId(assetLabel)}.png`,
      filePath: mapPath,
      contentType: "image/png",
    });
  },
  async cleanupStorage({ config, stableId }) {
    await removeStorageObject(config, {
      bucket: "question-assets",
      objectPath: `question-assets/${stableId(assetLabel)}.png`,
    });
  },
  manifest({ stableId }) {
    return {
      room: { id: stableId("room:steel-ball-run"), slug: "sbr-main" },
      seasonId: stableId("season:steel-ball-run"),
      challengeId: stableId("challenge-definition:steel-ball-run"),
      challengeVersionId: stableId("challenge-version:steel-ball-run-v1"),
      publicationId: stableId("publication:steel-ball-run"),
      questionSlugs: SBR_QUESTIONS.map((item) => item.slug),
      questionVersionIds: SBR_QUESTIONS.map((item) => questionVersionId(stableId, item.slug)),
      challengeItemIds: SBR_QUESTIONS.map((item) => challengeItemId(stableId, item.slug)),
      pointsTotal: SBR_QUESTIONS.reduce((total, item) => total + item.points, 0),
      asset: {
        id: stableId(assetLabel),
        bucket: "question-assets",
        objectPath: `question-assets/${stableId(assetLabel)}.png`,
      },
    };
  },
};

export default scenario;
