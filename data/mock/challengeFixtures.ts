import { publishedChallengeFixtures } from "@/data/mock/catalog/challenges";
import { CONTENT_CREATED_AT, CONTENT_PUBLISHED_AT, demoIdentity } from "@/data/mock/constants";
import { mockId } from "@/data/mock/identity";
import type { ChallengeDefinition, ChallengeItem, ChallengeVersion } from "@/types/domain";

export const challengeDefinitions: readonly ChallengeDefinition[] = publishedChallengeFixtures.map(
  (fixture) => ({
    id: mockId.challengeDefinition(fixture.slug),
    slug: fixture.slug,
    createdByPlayerId: demoIdentity.superadminPlayerId,
    archivedAt: null,
    createdAt: CONTENT_CREATED_AT,
    updatedAt: CONTENT_PUBLISHED_AT,
  }),
);

export const challengeVersions: readonly ChallengeVersion[] = publishedChallengeFixtures.map(
  (fixture) => ({
    id: mockId.challengeVersion(`${fixture.slug}:v1`),
    challengeDefinitionId: mockId.challengeDefinition(fixture.slug),
    versionNumber: 1,
    status: "published",
    mode: fixture.mode,
    title: fixture.title,
    subtitle: fixture.subtitle,
    description: fixture.description,
    maxScore: 100,
    modeConfig: fixture.modeConfig,
    createdByPlayerId: demoIdentity.superadminPlayerId,
    publishedAt: CONTENT_PUBLISHED_AT,
    createdAt: CONTENT_CREATED_AT,
    updatedAt: CONTENT_PUBLISHED_AT,
  }),
);

export const challengeItems: readonly ChallengeItem[] = publishedChallengeFixtures.flatMap(
  (fixture) =>
    fixture.items.map((item, position) => ({
      id: mockId.challengeItem(`${fixture.slug}:v1:${position + 1}`),
      challengeVersionId: mockId.challengeVersion(`${fixture.slug}:v1`),
      questionVersionId: mockId.questionVersion(`${item.questionSlug}:v1`),
      position: position + 1,
      points: item.points,
      modeConfig: item.modeConfig,
      createdAt: CONTENT_CREATED_AT,
      updatedAt: CONTENT_PUBLISHED_AT,
    })),
);

export const challengeQuestionSlugs = new Map(
  publishedChallengeFixtures.map((fixture) => [
    fixture.slug,
    fixture.items.map(({ questionSlug }) => questionSlug),
  ]),
);
