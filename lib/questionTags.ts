export const DOMAIN_TAGS = [
  { id: "mathematics", label: "Matematicas" },
  { id: "natural_sciences", label: "Ciencias naturales" },
  { id: "technology", label: "Tecnologia" },
  { id: "history", label: "Historia" },
  { id: "geography", label: "Geografia" },
  { id: "society_politics_law", label: "Sociedad, politica y derecho" },
  { id: "economics", label: "Economia" },
  { id: "language_communication", label: "Lenguaje y comunicacion" },
  { id: "literature", label: "Literatura y narrativas" },
  { id: "philosophy", label: "Filosofia y pensamiento" },
  { id: "art_design", label: "Arte y diseno" },
  { id: "music", label: "Musica y sonido" },
  { id: "media_entertainment", label: "Cine, medios y entretenimiento" },
  { id: "sports", label: "Deportes y actividad fisica" },
  { id: "culture", label: "Cultura y diversidad humana" },
] as const;

export type DomainTagId = (typeof DOMAIN_TAGS)[number]["id"];

export type TopicDefinition = {
  id: string;
  label: string;
  primaryDomain: DomainTagId;
  relatedDomains?: readonly DomainTagId[];
};

export const TOPIC_TAGS = [
  { id: "capitals", label: "Capitales", primaryDomain: "geography" },
  {
    id: "countries_flags",
    label: "Paises y banderas",
    primaryDomain: "geography",
    relatedDomains: ["culture"],
  },
  {
    id: "landmarks",
    label: "Monumentos y lugares",
    primaryDomain: "geography",
    relatedDomains: ["culture", "history"],
  },
  { id: "maps", label: "Mapas y localizacion", primaryDomain: "geography" },
  {
    id: "orientation",
    label: "Orientacion espacial",
    primaryDomain: "geography",
    relatedDomains: ["mathematics"],
  },
  { id: "sound_waves", label: "Sonido y ondas", primaryDomain: "natural_sciences" },
  { id: "astronomy_planets", label: "Planetas y astronomia", primaryDomain: "natural_sciences" },
  { id: "chemistry_elements", label: "Elementos quimicos", primaryDomain: "natural_sciences" },
  { id: "biology_taxonomy", label: "Taxonomia biologica", primaryDomain: "natural_sciences" },
  { id: "human_anatomy", label: "Anatomia humana", primaryDomain: "natural_sciences" },
  {
    id: "scientists",
    label: "Personas cientificas",
    primaryDomain: "natural_sciences",
    relatedDomains: ["history"],
  },
  {
    id: "weather",
    label: "Meteorologia",
    primaryDomain: "natural_sciences",
    relatedDomains: ["geography"],
  },
  { id: "world_war_ii", label: "Segunda Guerra Mundial", primaryDomain: "history" },
  {
    id: "inventions",
    label: "Inventos e industrializacion",
    primaryDomain: "history",
    relatedDomains: ["technology"],
  },
  {
    id: "space_exploration",
    label: "Exploracion espacial",
    primaryDomain: "history",
    relatedDomains: ["natural_sciences", "technology"],
  },
  {
    id: "computing_units",
    label: "Unidades de informacion",
    primaryDomain: "technology",
    relatedDomains: ["mathematics"],
  },
  { id: "number_sequences", label: "Secuencias numericas", primaryDomain: "mathematics" },
  {
    id: "letter_patterns",
    label: "Patrones de letras",
    primaryDomain: "mathematics",
    relatedDomains: ["language_communication"],
  },
  { id: "arithmetic", label: "Aritmetica", primaryDomain: "mathematics" },
  {
    id: "logic_puzzles",
    label: "Puzzles logicos",
    primaryDomain: "mathematics",
    relatedDomains: ["philosophy"],
  },
  {
    id: "spatial_logic_puzzles",
    label: "Puzzles de logica espacial",
    primaryDomain: "mathematics",
  },
  {
    id: "visual_patterns",
    label: "Patrones visuales",
    primaryDomain: "mathematics",
    relatedDomains: ["art_design"],
  },
  {
    id: "word_groups",
    label: "Relaciones entre palabras",
    primaryDomain: "language_communication",
  },
  { id: "vocabulary", label: "Vocabulario", primaryDomain: "language_communication" },
  { id: "spelling", label: "Ortografia", primaryDomain: "language_communication" },
  {
    id: "cinema",
    label: "Cine",
    primaryDomain: "media_entertainment",
    relatedDomains: ["culture"],
  },
  {
    id: "popular_music",
    label: "Musica popular",
    primaryDomain: "music",
    relatedDomains: ["culture"],
  },
  {
    id: "olympics",
    label: "Juegos Olimpicos",
    primaryDomain: "sports",
    relatedDomains: ["history", "culture"],
  },
  { id: "memory_training", label: "Entrenamiento de memoria", primaryDomain: "mathematics" },
  {
    id: "personal_finance",
    label: "Finanzas personales",
    primaryDomain: "economics",
    relatedDomains: ["mathematics"],
  },
] as const satisfies readonly TopicDefinition[];

export type TopicTagId = (typeof TOPIC_TAGS)[number]["id"];

export const COGNITIVE_SKILL_TAGS = [
  "memory",
  "comprehension",
  "logical_reasoning",
  "critical_thinking",
  "quantitative_reasoning",
  "scientific_reasoning",
  "problem_solving",
  "pattern_recognition",
  "decision_making",
  "creativity",
  "metacognition",
] as const;

export type CognitiveSkillTagId = (typeof COGNITIVE_SKILL_TAGS)[number];

export const FORMAT_SKILL_TAGS = [
  "recall",
  "classification",
  "ordering",
  "comparison",
  "estimation",
  "calculation",
  "interpretation",
  "deduction",
  "error_detection",
  "planning",
] as const;

export type FormatSkillTagId = (typeof FORMAT_SKILL_TAGS)[number];

export const LIFE_SKILL_TAGS = [
  "personal_finance",
  "health_self_care",
  "digital_literacy",
  "communication",
  "collaboration",
  "citizenship",
  "emotional_intelligence",
  "organization_productivity",
  "adaptability",
  "environmental_awareness",
  "entrepreneurship",
] as const;

export type LifeSkillTagId = (typeof LIFE_SKILL_TAGS)[number];

export type QuestionTags = {
  domains: readonly DomainTagId[];
  topics: readonly TopicTagId[];
  cognitiveSkills: readonly CognitiveSkillTagId[];
  formatSkills: readonly FormatSkillTagId[];
  lifeSkills?: readonly LifeSkillTagId[];
};

export type DomainDefinition = (typeof DOMAIN_TAGS)[number];

export type TagValidationResult = { valid: true; errors: [] } | { valid: false; errors: string[] };

export function getDomainDefinition(domainId: DomainTagId): DomainDefinition | undefined {
  return DOMAIN_TAGS.find((domain) => domain.id === domainId);
}

export function getTopicDefinition(topicId: TopicTagId): TopicDefinition | undefined {
  return TOPIC_TAGS.find((topic) => topic.id === topicId);
}

export function getTopicDomainIds(topicId: TopicTagId): DomainTagId[] {
  const topic = getTopicDefinition(topicId);

  if (!topic) {
    return [];
  }

  return [topic.primaryDomain, ...(topic.relatedDomains ?? [])];
}

export function getQuestionDomainIds(question: { tags: QuestionTags }): DomainTagId[] {
  return Array.from(
    new Set([...question.tags.domains, ...question.tags.topics.flatMap(getTopicDomainIds)]),
  );
}

export function validateQuestionTags(tags: QuestionTags): TagValidationResult {
  const errors: string[] = [];

  if (tags.domains.length === 0) {
    errors.push("domains must include at least one value");
  }

  if (tags.topics.length === 0) {
    errors.push("topics must include at least one value");
  }

  if (tags.cognitiveSkills.length === 0) {
    errors.push("cognitiveSkills must include at least one value");
  }

  if (tags.formatSkills.length === 0) {
    errors.push("formatSkills must include at least one value");
  }

  for (const topicId of tags.topics) {
    const topicDomains = getTopicDomainIds(topicId);

    if (topicDomains.length === 0) {
      errors.push(`unknown topic: ${topicId}`);
      continue;
    }

    if (!topicDomains.some((domainId) => tags.domains.includes(domainId))) {
      errors.push(`topic ${topicId} is not related to any declared domain`);
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}
