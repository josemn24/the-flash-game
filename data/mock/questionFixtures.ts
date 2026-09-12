import { publishedQuestionFixtures } from "@/data/mock/catalog/questions";
import { CONTENT_CREATED_AT, CONTENT_PUBLISHED_AT, demoIdentity } from "@/data/mock/constants";
import { mockId } from "@/data/mock/identity";
import type { QuestionDefinition, QuestionVersion } from "@/types/domain";

export const questionDefinitions: readonly QuestionDefinition[] = publishedQuestionFixtures.map(
  ({ slug }) => ({
    id: mockId.questionDefinition(slug),
    slug,
    createdByPlayerId: demoIdentity.superadminPlayerId,
    archivedAt: null,
    createdAt: CONTENT_CREATED_AT,
    updatedAt: CONTENT_PUBLISHED_AT,
  }),
);

export const questionVersions: readonly QuestionVersion[] = publishedQuestionFixtures.map(
  (fixture) =>
    ({
      id: mockId.questionVersion(`${fixture.slug}:v1`),
      questionDefinitionId: mockId.questionDefinition(fixture.slug),
      versionNumber: 1,
      status: "published",
      type: fixture.type,
      publicPayload: fixture.publicPayload,
      solutionPayload: fixture.privatePayload,
      createdByPlayerId: demoIdentity.superadminPlayerId,
      publishedAt: CONTENT_PUBLISHED_AT,
      createdAt: CONTENT_CREATED_AT,
      updatedAt: CONTENT_PUBLISHED_AT,
    }) as QuestionVersion,
);
