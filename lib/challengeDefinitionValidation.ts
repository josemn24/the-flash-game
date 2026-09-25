import { getConfiguredChallengeQuestionPointValues } from "@/lib/challengeScoring";
import type {
  NarrativeChallengeDefinition,
  NarrativeOutcome,
  NarrativeScene,
  PyramidChallengeDefinition,
} from "@/types/gameplay/challenge";

const narrativeOutcomes = [
  "correct",
  "incorrect",
  "timeout",
] as const satisfies readonly NarrativeOutcome[];

function validateNarrativeBlocks(blocks: NarrativeScene["blocks"], context: string) {
  if (blocks.length === 0) {
    throw new Error(`${context} must contain at least one narrative block.`);
  }

  blocks.forEach((block, index) => {
    if (block.text.trim().length === 0) {
      throw new Error(`${context} contains an empty block at index ${index}.`);
    }
    if (block.type === "dialogue" && block.speaker.trim().length === 0) {
      throw new Error(`${context} contains dialogue without a speaker at index ${index}.`);
    }
  });
}

export function getNarrativeQuestionIds<QuestionId extends string>(
  definition: NarrativeChallengeDefinition<QuestionId>,
) {
  return definition.beats.flatMap((beat) =>
    beat.steps.flatMap((step) => (step.type === "question" ? [step.questionId] : [])),
  );
}

export function validateNarrativeChallengeDefinition<QuestionId extends string>(
  definition: NarrativeChallengeDefinition<QuestionId>,
  knownQuestionIds: ReadonlySet<string>,
) {
  if (!Number.isInteger(definition.maxScore) || definition.maxScore <= 0) {
    throw new Error("Narrative challenge maxScore must be a positive integer.");
  }

  const questionIds = getNarrativeQuestionIds(definition);
  const sceneIds = [
    definition.prologue.id,
    ...definition.beats.flatMap((beat) =>
      beat.steps.flatMap((step) => (step.type === "scene" ? [step.scene.id] : [])),
    ),
  ];
  const beatIds = definition.beats.map((beat) => beat.id);
  validateNarrativeBlocks(
    definition.prologue.blocks,
    `Narrative scene "${definition.prologue.id}"`,
  );
  definition.beats.forEach((beat) =>
    beat.steps.forEach((step) => {
      if (step.type === "scene") {
        validateNarrativeBlocks(step.scene.blocks, `Narrative scene "${step.scene.id}"`);
        return;
      }

      const reactions = step.reactions;
      if (!reactions) return;

      narrativeOutcomes.forEach((outcome) => {
        const blocks = reactions[outcome];
        if (!Array.isArray(blocks)) {
          throw new Error(
            `Narrative question "${step.questionId}" is missing the "${outcome}" reaction.`,
          );
        }
        validateNarrativeBlocks(
          blocks,
          `Narrative question "${step.questionId}" reaction "${outcome}"`,
        );
      });
    }),
  );

  const duplicateIds = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds(beatIds).length > 0) {
    throw new Error("Narrative challenge beat IDs must be unique.");
  }
  if (duplicateIds(questionIds).length > 0) {
    throw new Error("Narrative challenge question IDs must be unique.");
  }
  if (duplicateIds(sceneIds).length > 0) {
    throw new Error("Narrative challenge scene IDs must be unique.");
  }
  const unknownQuestionIds = questionIds.filter((id) => !knownQuestionIds.has(id));
  if (unknownQuestionIds.length > 0) {
    throw new Error(
      `Narrative challenge references unknown questions: ${unknownQuestionIds.join(", ")}`,
    );
  }

  const unknownScoringIds = Object.keys(definition.questionPoints).filter(
    (id) => !questionIds.includes(id as (typeof questionIds)[number]),
  );
  if (unknownScoringIds.length > 0) {
    throw new Error(
      `Narrative challenge scoring references unknown questions: ${unknownScoringIds.join(", ")}`,
    );
  }

  getConfiguredChallengeQuestionPointValues(
    questionIds,
    definition.questionPoints,
    definition.maxScore,
  );
}

export function getPyramidQuestionIds<QuestionId extends string>(
  definition: PyramidChallengeDefinition<QuestionId>,
) {
  return definition.levels.map((level) => level.questionId);
}

export function validatePyramidChallengeDefinition<QuestionId extends string>(
  definition: PyramidChallengeDefinition<QuestionId>,
  knownQuestionIds: ReadonlySet<string>,
) {
  if (!Number.isInteger(definition.attemptVersion) || definition.attemptVersion <= 0) {
    throw new Error("Pyramid challenge attemptVersion must be a positive integer.");
  }
  if (definition.levels.length < 5 || definition.levels.length > 7) {
    throw new Error("Pyramid challenge must contain between five and seven levels.");
  }

  const levelIds = definition.levels.map((level) => level.id);
  const questionIds = getPyramidQuestionIds(definition);
  if (new Set(levelIds).size !== levelIds.length) {
    throw new Error("Pyramid challenge level IDs must be unique.");
  }
  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error("Pyramid challenge question IDs must be unique.");
  }
  if (
    definition.levels.some(
      (level) =>
        !level.id.trim() ||
        !level.label.trim() ||
        !level.briefing.title.trim() ||
        !level.briefing.format.trim() ||
        !level.briefing.description.trim(),
    )
  ) {
    throw new Error("Pyramid challenge levels require non-empty IDs, labels and briefings.");
  }

  const unknownQuestionIds = questionIds.filter((id) => !knownQuestionIds.has(id));
  if (unknownQuestionIds.length > 0) {
    throw new Error(`Pyramid challenge references unknown questions: ${unknownQuestionIds}`);
  }
  const unknownScoringIds = Object.keys(definition.questionPoints).filter(
    (id) => !questionIds.includes(id as (typeof questionIds)[number]),
  );
  if (unknownScoringIds.length > 0) {
    throw new Error(`Pyramid challenge scoring references unknown questions: ${unknownScoringIds}`);
  }

  getConfiguredChallengeQuestionPointValues(questionIds, definition.questionPoints);
}
