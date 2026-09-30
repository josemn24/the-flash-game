/**
 * Canonical identifiers used to classify question content.
 *
 * Runtime definitions and validation live in `lib/questionTags.ts`; this
 * module intentionally contains only domain types so type layers do not
 * depend on application code.
 */

export type DomainTagId =
  | "mathematics"
  | "natural_sciences"
  | "technology"
  | "history"
  | "geography"
  | "society_politics_law"
  | "economics"
  | "language_communication"
  | "literature"
  | "philosophy"
  | "art_design"
  | "music"
  | "media_entertainment"
  | "sports"
  | "culture";

export type TopicTagId =
  | "capitals"
  | "countries_flags"
  | "landmarks"
  | "maps"
  | "orientation"
  | "sound_waves"
  | "astronomy_planets"
  | "chemistry_elements"
  | "biology_taxonomy"
  | "human_anatomy"
  | "scientists"
  | "weather"
  | "world_war_ii"
  | "inventions"
  | "space_exploration"
  | "computing_units"
  | "number_sequences"
  | "letter_patterns"
  | "arithmetic"
  | "logic_puzzles"
  | "spatial_logic_puzzles"
  | "visual_patterns"
  | "word_groups"
  | "vocabulary"
  | "spelling"
  | "cinema"
  | "television_series"
  | "video_games"
  | "popular_music"
  | "olympics"
  | "memory_training"
  | "personal_finance";

export type CognitiveSkillTagId =
  | "memory"
  | "comprehension"
  | "logical_reasoning"
  | "critical_thinking"
  | "quantitative_reasoning"
  | "scientific_reasoning"
  | "problem_solving"
  | "pattern_recognition"
  | "decision_making"
  | "creativity"
  | "metacognition";

export type FormatSkillTagId =
  | "recall"
  | "classification"
  | "ordering"
  | "comparison"
  | "estimation"
  | "calculation"
  | "interpretation"
  | "deduction"
  | "error_detection"
  | "planning";

export type LifeSkillTagId =
  | "personal_finance"
  | "health_self_care"
  | "digital_literacy"
  | "communication"
  | "collaboration"
  | "citizenship"
  | "emotional_intelligence"
  | "organization_productivity"
  | "adaptability"
  | "environmental_awareness"
  | "entrepreneurship";

export type QuestionTags = {
  readonly domains: readonly DomainTagId[];
  readonly topics: readonly TopicTagId[];
  readonly cognitiveSkills: readonly CognitiveSkillTagId[];
  readonly formatSkills: readonly FormatSkillTagId[];
  readonly lifeSkills?: readonly LifeSkillTagId[];
};

export type QuestionTagSet = Omit<QuestionTags, "lifeSkills"> & {
  readonly lifeSkills: readonly LifeSkillTagId[];
};
