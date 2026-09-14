import { publishedChallengeFixtures } from "@/data/mock/catalog/challenges";
import { questionGroups } from "@/data/mock/catalog/questions/groups";
import type { QuestionSlug } from "@/data/mock/catalog/questions";
import { projectLegacyChallengeDefinition } from "@/data/mock/legacyChallengeDefinitionAdapter";
import { legacyChallenges, reconstructLegacyChallenge } from "@/data/mock/legacyChallengeAdapter";
import {
  legacyQuestionsBySlug,
  reconstructLegacyQuestion,
} from "@/data/mock/legacyQuestionAdapter";
import { mockId } from "@/data/mock/identity";
import {
  getNarrativeQuestionIds,
  getPyramidQuestionIds,
  validateNarrativeChallengeDefinition as validateNarrativeDefinition,
  validatePyramidChallengeDefinition as validatePyramidDefinition,
} from "@/lib/challengeDefinitionValidation";
import { mockDomainStore } from "@/data/mock/store";
import { scheduledChallenges } from "@/data/mock/socialFixtures";
import type { Challenge, Question } from "@/types/game";
import type { ChallengeDefinition } from "@/types/gameplay/challenge";

export { getNarrativeQuestionIds, getPyramidQuestionIds };

const knownQuestionIds = new Set(mockDomainStore.questionDefinitions.map(({ slug }) => slug));

export function validateNarrativeChallengeDefinition(
  definition: Extract<ChallengeDefinition, { mode: "narrative" }>,
) {
  return validateNarrativeDefinition(definition, knownQuestionIds);
}

export function validatePyramidChallengeDefinition(
  definition: Extract<ChallengeDefinition, { mode: "pyramid" }>,
) {
  return validatePyramidDefinition(definition, knownQuestionIds);
}

export type MockQuestionId = QuestionSlug;
export type QuestionId = MockQuestionId;

export const mockQuestionsById = legacyQuestionsBySlug;
export const questionsById = mockQuestionsById;
export { questionGroups };

export function getQuestionsByIds(ids: readonly MockQuestionId[]) {
  return ids.map((id) => mockQuestionsById[id]);
}

export function getMockQuestionById(id: string): Question | undefined {
  const versionId = mockId.questionVersion(`${id}:v1`);
  return reconstructLegacyQuestion(versionId);
}

export const mockChallenges: readonly Challenge[] = legacyChallenges;
export const challenges = mockChallenges;

export function getMockChallengeById(id: string): Challenge | undefined {
  const schedule = scheduledChallenges.find(
    (candidate) => candidate.id === mockId.scheduledChallenge(id),
  );
  return schedule ? reconstructLegacyChallenge(schedule.id) : undefined;
}

export const getChallengeById = getMockChallengeById;

export const mockChallengeDefinitions = Object.fromEntries(
  publishedChallengeFixtures.map((fixture) => [
    fixture.slug,
    projectLegacyChallengeDefinition(fixture),
  ]),
) as {
  readonly [Fixture in (typeof publishedChallengeFixtures)[number] as Fixture["slug"]]: Extract<
    ChallengeDefinition<QuestionSlug>,
    { mode: Fixture["mode"] }
  >;
};
export const challengeDefinitions = mockChallengeDefinitions;

export function getMockChallengeDefinitionById(id: string) {
  return mockChallengeDefinitions[id as keyof typeof mockChallengeDefinitions];
}

export const getChallengeDefinitionById = getMockChallengeDefinitionById;
