import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { demoRoom } from "@/data/demoRoom";
import { getQuestionsByIds, questionsById } from "@/data/questions";
import {
  getConfiguredChallengeQuestionPointValues,
  withChallengeQuestionPoints,
} from "@/lib/challengeScoring";
import type {
  Challenge,
  NarrativeChallengeDefinition,
  NarrativeOutcome,
  NarrativeQuestionStep,
  NarrativeScene,
  PlayableScheduledChallenge,
  PyramidChallengeDefinition,
  ScheduledChallenge,
} from "@/types/game";

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

function isPlayableScheduledChallenge(
  scheduledChallenge: ScheduledChallenge,
): scheduledChallenge is PlayableScheduledChallenge {
  return "challengeDefinitionId" in scheduledChallenge;
}

export function getNarrativeQuestionIds(definition: NarrativeChallengeDefinition) {
  return definition.beats.flatMap((beat) =>
    beat.steps.flatMap((step) => (step.type === "question" ? [step.questionId] : [])),
  );
}

export function validateNarrativeChallengeDefinition(definition: NarrativeChallengeDefinition) {
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
  const notebookEntryIds = definition.notebookEntries.map((entry) => entry.id);
  const unlockedEntryIds = definition.beats.flatMap((beat) =>
    beat.steps.flatMap((step) => step.unlockEntryIds ?? []),
  );

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
  if (duplicateIds(notebookEntryIds).length > 0) {
    throw new Error("Narrative challenge notebook entry IDs must be unique.");
  }
  if (duplicateIds(unlockedEntryIds).length > 0) {
    throw new Error("Narrative challenge notebook entries must unlock exactly once.");
  }

  const unknownQuestionIds = questionIds.filter((id) => !(id in questionsById));
  if (unknownQuestionIds.length > 0) {
    throw new Error(
      `Narrative challenge references unknown questions: ${unknownQuestionIds.join(", ")}`,
    );
  }

  const unknownEntryIds = unlockedEntryIds.filter((id) => !notebookEntryIds.includes(id));
  if (unknownEntryIds.length > 0) {
    throw new Error(`Narrative challenge references unknown notebook entries: ${unknownEntryIds}`);
  }

  const lockedEntryIds = notebookEntryIds.filter((id) => !unlockedEntryIds.includes(id));
  if (lockedEntryIds.length > 0) {
    throw new Error(`Narrative challenge never unlocks notebook entries: ${lockedEntryIds}`);
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

export function getPyramidQuestionIds(definition: PyramidChallengeDefinition) {
  return definition.levels.map((level) => level.questionId);
}

export function validatePyramidChallengeDefinition(definition: PyramidChallengeDefinition) {
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
  if (definition.levels.some((level) => !level.id.trim() || !level.label.trim())) {
    throw new Error("Pyramid challenge levels require non-empty IDs and labels.");
  }

  const unknownQuestionIds = questionIds.filter((id) => !(id in questionsById));
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

function resolveScheduledChallenge(scheduledChallenge: PlayableScheduledChallenge): Challenge {
  const definition = getChallengeDefinitionById(scheduledChallenge.challengeDefinitionId);
  if (!definition) {
    throw new Error(
      `Missing challenge definition for scheduled challenge "${scheduledChallenge.id}"`,
    );
  }

  const base = {
    id: scheduledChallenge.id,
    definitionId: definition.id,
    number: scheduledChallenge.number,
    title: definition.title,
    subtitle: definition.subtitle,
    description: definition.description,
  };

  if (definition.mode === "alphabet") {
    const questions = getQuestionsByIds(definition.entries.map((entry) => entry.questionId));
    return {
      ...base,
      mode: "alphabet",
      timeLimit: definition.timeLimit,
      entries: definition.entries.map((entry, index) => ({
        letter: entry.letter,
        question: questions[index],
      })),
    };
  }

  if (definition.mode === "survival") {
    return {
      ...base,
      mode: "survival",
      lives: definition.lives,
      questions: getQuestionsByIds(definition.questionIds),
      questionPoints: definition.questionPoints,
    };
  }

  if (definition.mode === "pyramid") {
    validatePyramidChallengeDefinition(definition);
    const questions = getQuestionsByIds(getPyramidQuestionIds(definition));
    return {
      ...base,
      mode: "pyramid",
      attemptVersion: definition.attemptVersion,
      availableFrom: scheduledChallenge.availableFrom,
      availableUntil: scheduledChallenge.availableUntil,
      levels: definition.levels.map((level, index) => ({
        id: level.id,
        label: level.label,
        question: questions[index],
      })),
      questionPoints: definition.questionPoints,
    };
  }

  if (definition.mode === "narrative") {
    validateNarrativeChallengeDefinition(definition);
    const questionIds = getNarrativeQuestionIds(definition);
    const questions = getQuestionsByIds(questionIds);
    const pointValues = getConfiguredChallengeQuestionPointValues(
      questionIds,
      definition.questionPoints,
      definition.maxScore,
    );
    const resolvedQuestions = new Map(
      questions.map((question, index) => [
        question.id,
        withChallengeQuestionPoints(question, pointValues[index] ?? 0),
      ]),
    );

    return {
      ...base,
      mode: "narrative",
      implementationStatus: definition.implementationStatus,
      maxScore: definition.maxScore,
      prologue: definition.prologue,
      notebookEntries: definition.notebookEntries,
      beats: definition.beats.map((beat) => ({
        ...beat,
        steps: beat.steps.map((step) => {
          if (step.type === "scene") return step;
          const question = resolvedQuestions.get(step.questionId);
          if (!question) {
            throw new Error(`Missing narrative question "${step.questionId}".`);
          }
          return {
            type: "question",
            question,
            unlockEntryIds: step.unlockEntryIds,
            reactions: step.reactions,
          } satisfies NarrativeQuestionStep;
        }),
      })),
    };
  }

  return {
    ...base,
    mode: "flash",
    questions: getQuestionsByIds(definition.questionIds),
    questionPoints: definition.questionPoints,
  };
}

export const challenges = demoRoom.activeSeason.scheduledChallenges
  .filter(isPlayableScheduledChallenge)
  .map(resolveScheduledChallenge);

export function getChallengeById(id: string) {
  return challenges.find((challenge) => challenge.id === id);
}
