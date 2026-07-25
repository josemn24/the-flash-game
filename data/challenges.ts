import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { demoRoom } from "@/data/demoRoom";
import { getQuestionsByIds } from "@/data/questions";
import type { Challenge, PlayableScheduledChallenge, ScheduledChallenge } from "@/types/game";

function isPlayableScheduledChallenge(
  scheduledChallenge: ScheduledChallenge,
): scheduledChallenge is PlayableScheduledChallenge {
  return "challengeDefinitionId" in scheduledChallenge;
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
