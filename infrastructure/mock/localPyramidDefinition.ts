import { mockDomainStore } from "@/data/mock/store";
import { isCompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { DomainStore } from "@/types/domain";
import type { TypedQuestionVersion } from "@/types/contracts";
import type { LocalPyramidDefinition, LocalPyramidLevel } from "@/types/gameplay/local-pyramid";
import type { ServerPyramidChallenge } from "@/types/gameplay/challenge";

/** Canonical mock composition only; competitive routes never select or import this adapter. */
export function createMockLocalPyramidDefinition(
  publicationId: string,
  store: DomainStore = mockDomainStore,
): LocalPyramidDefinition {
  const publication = store.scheduledChallenges.find((row) => row.id === publicationId);
  const version = store.challengeVersions.find((row) => row.id === publication?.challengeVersionId);
  if (!publication || !version || version.mode !== "pyramid" || version.status !== "published")
    throw new Error("mock_pyramid_not_found");
  const items = store.challengeItems
    .filter((row) => row.challengeVersionId === version.id)
    .sort((a, b) => a.position - b.position);
  const levels = items.map((item): LocalPyramidLevel => {
    const raw = store.questionVersions.find((row) => row.id === item.questionVersionId);
    if (!raw || !isCompetitiveQuestionType(raw.type, "pyramid") || raw.status !== "published")
      throw new Error("unsupported_mock_pyramid_question");
    const question = raw as unknown as TypedQuestionVersion;
    return {
      challengeItemId: item.id,
      payloadSchemaVersion: question.payloadSchemaVersion,
      publicQuestion: { ...question.publicPayload, id: question.id, type: question.type },
      solution: {
        ...question.solutionPayload.solution,
        questionVersionId: question.id,
        type: question.type,
      },
      reveals: question.solutionPayload.reveals.map((payload) => ({
        questionVersionId: question.id,
        type: question.type,
        payload,
      })),
    } as LocalPyramidLevel;
  });
  const slots = items.map((item, index) => {
    const level = levels[index]!;
    const config = item.modeConfig as Record<string, unknown>;
    if (
      typeof config.levelId !== "string" ||
      typeof config.label !== "string" ||
      !config.briefing ||
      typeof config.briefing !== "object"
    )
      throw new Error("invalid_mock_pyramid_briefing");
    return {
      id: item.id,
      position: item.position,
      levelId: config.levelId,
      label: config.label,
      briefing: config.briefing,
      questionType: level.publicQuestion.type,
      payloadSchemaVersion: level.payloadSchemaVersion,
      timeLimitMs: level.publicQuestion.timeLimitMs,
      points: item.points,
    };
  });
  return {
    challenge: {
      id: publication.id,
      definitionId: version.challengeDefinitionId,
      number: publication.number,
      title: version.title,
      subtitle: version.subtitle,
      description: version.description,
      mode: "pyramid",
      maxScore: 100,
      attemptVersion: version.versionNumber,
      availableFrom: publication.opensAt,
      availableUntil: publication.closesAt,
      levels: slots,
    } as ServerPyramidChallenge,
    levels,
  };
}
