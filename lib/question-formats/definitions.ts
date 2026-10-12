import type { QuestionType } from "@/types/contracts/questions";
import type { GameMode } from "@/types/domain/content";
import { definition as anagramDefinition } from "./anagram/definition";
import { definition as classificationDefinition } from "./classification/definition";
import { definition as connectPairsDefinition } from "./connect-pairs/definition";
import { definition as escapeDefinition } from "./escape/definition";
import { definition as estimationDefinition } from "./estimation/definition";
import { definition as heatMapDefinition } from "./heat-map/definition";
import { definition as logicCodeDefinition } from "./logic-code/definition";
import { definition as logicMatrixDefinition } from "./logic-matrix/definition";
import { definition as matchingDefinition } from "./matching/definition";
import type { CompetitiveFormatCapability, FormatCapabilities } from "./metadata";
import { definition as miniWordleDefinition } from "./mini-wordle/definition";
import { definition as multipleChoiceDefinition } from "./multiple-choice/definition";
import { definition as oddOneOutDefinition } from "./odd-one-out/definition";
import { definition as orderingDefinition } from "./ordering/definition";
import { practiceDefinitions } from "./practiceDefinitions";
import { definition as progressiveCluesDefinition } from "./progressive-clues/definition";
import { definition as progressiveImageDefinition } from "./progressive-image/definition";
import { definition as queensDefinition } from "./queens/definition";
import { definition as shortTextDefinition } from "./short-text/definition";
import { definition as trueFalseDefinition } from "./true-false/definition";
import { definition as wordHashtagDefinition } from "./word-hashtag/definition";
import { definition as wordSearchDefinition } from "./word-search/definition";
import { definition as zipDefinition } from "./zip/definition";
export const COMPETITIVE_FORMAT_DEFINITIONS = {
  "multiple-choice": multipleChoiceDefinition,
  "odd-one-out": oddOneOutDefinition,
  matching: matchingDefinition,
  "connect-pairs": connectPairsDefinition,
  "true-false": trueFalseDefinition,
  "short-text": shortTextDefinition,
  "progressive-clues": progressiveCluesDefinition,
  "progressive-image": progressiveImageDefinition,
  "heat-map": heatMapDefinition,
  ordering: orderingDefinition,
  classification: classificationDefinition,
  "logic-matrix": logicMatrixDefinition,
  queens: queensDefinition,
  zip: zipDefinition,
  escape: escapeDefinition,
  anagram: anagramDefinition,
  "word-hashtag": wordHashtagDefinition,
  "word-search": wordSearchDefinition,
  "mini-wordle": miniWordleDefinition,
  "logic-code": logicCodeDefinition,
  estimation: estimationDefinition,
} as const satisfies Partial<Record<QuestionType, FormatCapabilities>>;
export type CompetitiveQuestionType = keyof typeof COMPETITIVE_FORMAT_DEFINITIONS;
export const COMPETITIVE_FORMAT_TYPES = Object.keys(
  COMPETITIVE_FORMAT_DEFINITIONS,
) as CompetitiveQuestionType[];
export const QUESTION_FORMAT_CAPABILITIES = {
  ...practiceDefinitions,
  ...COMPETITIVE_FORMAT_DEFINITIONS,
} as const satisfies Record<QuestionType, FormatCapabilities>;

const capabilityMap = QUESTION_FORMAT_CAPABILITIES as Record<QuestionType, FormatCapabilities>;

export const QUESTION_FORMAT_TYPES = Object.keys(QUESTION_FORMAT_CAPABILITIES) as QuestionType[];

export function capabilityForQuestionType(type: QuestionType): FormatCapabilities {
  return capabilityMap[type];
}

export function competitiveCapabilityFor(
  type: QuestionType,
  mode: GameMode,
): CompetitiveFormatCapability | null {
  return capabilityMap[type].competitive[mode] ?? null;
}

export function competitiveQuestionTypesFor(mode: GameMode): readonly QuestionType[] {
  return QUESTION_FORMAT_TYPES.filter(
    (type) => capabilityMap[type].competitive[mode] !== undefined,
  );
}

export function isCompetitiveQuestionType(
  type: string,
  mode?: GameMode,
): type is CompetitiveQuestionType {
  const definition = capabilityMap[type as QuestionType];
  if (!definition) return false;
  return mode
    ? competitiveCapabilityFor(type as QuestionType, mode) !== null
    : Object.values(definition.competitive).length > 0;
}

export function competitivePayloadSchemaVersionsFor(
  type: QuestionType,
  mode?: GameMode,
): readonly number[] {
  if (mode) return competitiveCapabilityFor(type, mode)?.payloadSchemaVersions ?? [];
  return [
    ...new Set(
      Object.values(capabilityMap[type].competitive).flatMap(
        (capability) => capability.payloadSchemaVersions,
      ),
    ),
  ];
}

export const COMPETITIVE_SQL_EXTENSION_TYPES = QUESTION_FORMAT_TYPES.filter(
  (type) => capabilityMap[type].validation.sqlValidation === "competitive-extension",
);
