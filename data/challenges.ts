import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { demoRoom } from "@/data/demoRoom";
import { getQuestionsByIds } from "@/data/questions";
import type { Challenge, ScheduledChallenge } from "@/types/game";

function resolveScheduledChallenge(scheduledChallenge: ScheduledChallenge): Challenge {
  const definition = getChallengeDefinitionById(scheduledChallenge.challengeDefinitionId);
  if (!definition) {
    throw new Error(
      `Missing challenge definition for scheduled challenge "${scheduledChallenge.id}"`,
    );
  }

  return {
    id: scheduledChallenge.id,
    definitionId: definition.id,
    number: scheduledChallenge.number,
    title: definition.title,
    subtitle: definition.subtitle,
    description: definition.description,
    mode: definition.mode,
    questions: getQuestionsByIds(definition.questionIds),
  };
}

export const challenges = demoRoom.activeSeason.scheduledChallenges.map(resolveScheduledChallenge);

export function getChallengeById(id: string) {
  return challenges.find((challenge) => challenge.id === id);
}
