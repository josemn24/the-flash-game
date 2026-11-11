import { pyramidPartialCreditOptions } from "@/lib/gameplay/pyramidPartialCredit";
import { mockDomainStore } from "@/data/mock/store";
import { scheduledChallengeRouteAliases } from "@/data/mock/constants";
import { isCompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { DomainStore } from "@/types/domain";
import type { TypedQuestionVersion } from "@/types/contracts";
import type {
  LocalFlashDefinition,
  LocalQuestionLevel,
  LocalPyramidDefinition,
  LocalSurvivalDefinition,
} from "@/types/gameplay/local-pyramid";
import type { LocalAlphabetDefinition } from "@/types/gameplay/local-alphabet";
import {
  FLASH_POP_ALPHABET_PILOT_ID,
  type FlashPopChallengeId,
} from "@/features/flash-pop/demoSocial";
import type {
  ServerAlphabetChallenge,
  ServerFlashQuestion,
  ServerPyramidChallenge,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";

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
  const levels = items.map((item) => localQuestionLevel(item, store, "pyramid"));
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
      ...pyramidPartialCreditOptions(version.modeConfig),
      availableFrom: publication.opensAt,
      availableUntil: publication.closesAt,
      levels: slots,
    } as ServerPyramidChallenge,
    levels,
  };
}

export function createMockLocalFlashDefinition(
  publicationId: string,
  store: DomainStore = mockDomainStore,
): LocalFlashDefinition {
  const publication = store.scheduledChallenges.find((row) => row.id === publicationId);
  const version = store.challengeVersions.find((row) => row.id === publication?.challengeVersionId);
  if (!publication || !version || version.mode !== "flash" || version.status !== "published")
    throw new Error("mock_flash_not_found");
  const items = store.challengeItems
    .filter((row) => row.challengeVersionId === version.id)
    .sort((a, b) => a.position - b.position);
  const levels = items.map((item) => localQuestionLevel(item, store, "flash"));
  const slots = items.map((item, index) => {
    const question = levels[index]!.publicQuestion;
    return {
      id: item.id,
      position: item.position,
      questionType: question.type as ServerFlashQuestion["type"],
      payloadSchemaVersion: levels[index]!.payloadSchemaVersion,
      timeLimitMs: question.timeLimitMs,
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
      mode: "flash",
      maxScore: slots.reduce((sum, slot) => sum + slot.points, 0),
      slots,
    },
    levels,
  };
}

export function createMockLocalSurvivalDefinition(
  publicationId: string,
  store: DomainStore = mockDomainStore,
): LocalSurvivalDefinition {
  const publication = store.scheduledChallenges.find((row) => row.id === publicationId);
  const version = store.challengeVersions.find((row) => row.id === publication?.challengeVersionId);
  if (!publication || !version || version.mode !== "survival" || version.status !== "published")
    throw new Error("mock_survival_not_found");
  const items = store.challengeItems
    .filter((row) => row.challengeVersionId === version.id)
    .sort((a, b) => a.position - b.position);
  const levels = items.map((item) => localQuestionLevel(item, store, "survival"));
  const lives = (version.modeConfig as Record<string, unknown>).lives;
  if (!Number.isSafeInteger(lives) || Number(lives) < 1)
    throw new Error("invalid_mock_survival_lives");
  const slots = items.map((item, index) => {
    const question = levels[index]!.publicQuestion;
    return {
      id: item.id,
      position: item.position,
      questionType: question.type as ServerFlashQuestion["type"],
      payloadSchemaVersion: levels[index]!.payloadSchemaVersion,
      timeLimitMs: question.timeLimitMs,
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
      mode: "survival",
      lives: Number(lives),
      maxScore: slots.reduce((sum, slot) => sum + slot.points, 0),
      slots,
    } satisfies ServerSurvivalChallenge,
    levels,
  };
}

export function createMockLocalAlphabetDefinition(
  publicationId: string,
  store: DomainStore = mockDomainStore,
): LocalAlphabetDefinition {
  const publication = store.scheduledChallenges.find((row) => row.id === publicationId);
  const version = store.challengeVersions.find((row) => row.id === publication?.challengeVersionId);
  if (!publication || !version || version.mode !== "alphabet" || version.status !== "published")
    throw new Error("mock_alphabet_not_found");
  const items = store.challengeItems
    .filter((row) => row.challengeVersionId === version.id)
    .sort((a, b) => a.position - b.position);
  const levels = items.map((item) => localQuestionLevel(item, store, "alphabet"));
  const entries = items.map((item, index) => {
    const config = item.modeConfig as Record<string, unknown>;
    const question = levels[index]!.publicQuestion;
    if (typeof config.letter !== "string" || question.type !== "short-text")
      throw new Error("invalid_mock_alphabet_entry");
    return {
      id: item.id,
      position: item.position,
      letter: config.letter,
      questionType: "short-text" as const,
      payloadSchemaVersion: levels[index]!.payloadSchemaVersion,
      timeLimitMs: question.timeLimitMs,
      points: item.points,
    };
  });
  const modeConfig = version.modeConfig as Record<string, unknown>;
  const challenge: ServerAlphabetChallenge = {
    id: publication.id,
    definitionId: version.challengeDefinitionId,
    number: publication.number,
    title: version.title,
    subtitle: version.subtitle,
    description: version.description,
    mode: "alphabet",
    timeLimitMs: Number(modeConfig.timeLimitMs),
    maxScore: version.maxScore,
    entries,
  };
  return { challenge, levels };
}

/** Canonical fixture for the date-independent local competitive Flash rehearsal. */
export function createMockFlashPopFlashDemoDefinition(): LocalFlashDefinition {
  const routeId = "tabarnia-flash-01" as const;
  const definition = createMockLocalFlashDefinition(scheduledChallengeRouteAliases[routeId]);
  return {
    ...definition,
    challenge: { ...definition.challenge, id: routeId },
  };
}

/** Canonical fixture for the date-independent local competitive Survival rehearsal. */
export function createMockFlashPopSurvivalDemoDefinition(): LocalSurvivalDefinition {
  const routeId = "tabarnia-challenge-03" as const;
  const definition = createMockLocalSurvivalDefinition(scheduledChallengeRouteAliases[routeId]);
  return {
    ...definition,
    challenge: { ...definition.challenge, id: routeId },
  };
}

/** Canonical fixture for the full 16-letter, date-independent local Alphabet rehearsal. */
export function createMockFlashPopAlphabetDemoDefinition(): LocalAlphabetDefinition {
  const routeId = FLASH_POP_ALPHABET_PILOT_ID;
  const definition = createMockLocalAlphabetDefinition(scheduledChallengeRouteAliases[routeId]);
  return {
    ...definition,
    challenge: { ...definition.challenge, id: routeId },
  };
}

/** Canonical fixture composition for the date-independent Flash Pop rehearsal route. */
export function createMockFlashPopPyramidDemoDefinition(
  routeId: FlashPopChallengeId = "tabarnia-challenge-05",
): LocalPyramidDefinition {
  const definition = createMockLocalPyramidDefinition(scheduledChallengeRouteAliases[routeId]);
  return {
    ...definition,
    challenge: {
      ...definition.challenge,
      id: routeId,
      availableFrom: "1970-01-01T00:00:00.000Z",
      availableUntil: "9999-12-31T23:59:59.999Z",
    },
  };
}

function localQuestionLevel(
  item: DomainStore["challengeItems"][number],
  store: DomainStore,
  mode: "flash" | "pyramid" | "survival" | "alphabet",
): LocalQuestionLevel {
  const raw = store.questionVersions.find((row) => row.id === item.questionVersionId);
  if (!raw || !isCompetitiveQuestionType(raw.type, mode) || raw.status !== "published")
    throw new Error(`unsupported_mock_${mode}_question`);
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
  } as LocalQuestionLevel;
}
