import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import type { PublicQuestion, QuestionReveal, QuestionSolution } from "@/types/contracts";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { QuestionTagSet } from "@/types/domain/content";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { MiniWordleQuestion, ResolvedQuestion } from "@/types/gameplay/scoring";
import { canonicalPayload as anagramPayload } from "./anagram/canonical";
import { validateSolution as anagramSolutionValidator } from "./anagram/solution";
import { canonicalPayload as classificationPayload } from "./classification/canonical";
import { validateSolution as classificationSolutionValidator } from "./classification/solution";
import { canonicalPayload as connectPairsPayload } from "./connect-pairs/canonical";
import { validateSolution as connectPairsSolutionValidator } from "./connect-pairs/solution";
import type { CompetitiveQuestionType } from "./definitions";
import { canonicalPayload as escapePayload } from "./escape/canonical";
import { validateSolution as escapeSolutionValidator } from "./escape/solution";
import { canonicalPayload as estimationPayload } from "./estimation/canonical";
import { validateSolution as estimationSolutionValidator } from "./estimation/solution";
import { canonicalPayload as heatMapPayload } from "./heat-map/canonical";
import { validateSolution as heatMapSolutionValidator } from "./heat-map/solution";
import { canonicalPayload as logicCodePayload } from "./logic-code/canonical";
import { validateSolution as logicCodeSolutionValidator } from "./logic-code/solution";
import { canonicalPayload as logicMatrixPayload } from "./logic-matrix/canonical";
import { validateSolution as logicMatrixSolutionValidator } from "./logic-matrix/solution";
import { canonicalPayload as matchingPayload } from "./matching/canonical";
import { validateSolution as matchingSolutionValidator } from "./matching/solution";
import { canonicalPayload as miniWordlePayload } from "./mini-wordle/canonical";
import { validateSolution as miniWordleSolutionValidator } from "./mini-wordle/solution";
import { canonicalPayload as multipleChoicePayload } from "./multiple-choice/canonical";
import { validateSolution as multipleChoiceSolutionValidator } from "./multiple-choice/solution";
import { canonicalPayload as oddOneOutPayload } from "./odd-one-out/canonical";
import { validateSolution as oddOneOutSolutionValidator } from "./odd-one-out/solution";
import { canonicalPayload as orderingPayload } from "./ordering/canonical";
import { validateSolution as orderingSolutionValidator } from "./ordering/solution";
import { canonicalPayload as progressiveCluesPayload } from "./progressive-clues/canonical";
import { validateSolution as progressiveCluesSolutionValidator } from "./progressive-clues/solution";
import { canonicalPayload as progressiveImagePayload } from "./progressive-image/canonical";
import { validateSolution as progressiveImageSolutionValidator } from "./progressive-image/solution";
import { canonicalPayload as queensPayload } from "./queens/canonical";
import { validateSolution as queensSolutionValidator } from "./queens/solution";
import { canonicalPayload as shortTextPayload } from "./short-text/canonical";
import { validateSolution as shortTextSolutionValidator } from "./short-text/solution";
import { STORED_PUBLIC_VALIDATORS } from "./storedPublicRegistry";
import { canonicalPayload as trueFalsePayload } from "./true-false/canonical";
import { validateSolution as trueFalseSolutionValidator } from "./true-false/solution";
import { FormatValidationError, type StoredQuestionResolution, validationResult } from "./types";
import { canonicalPayload as wordHashtagPayload } from "./word-hashtag/canonical";
import { validateSolution as wordHashtagSolutionValidator } from "./word-hashtag/solution";
import { canonicalPayload as wordSearchPayload } from "./word-search/canonical";
import { validateSolution as wordSearchSolutionValidator } from "./word-search/solution";
import { canonicalPayload as zipPayload } from "./zip/canonical";
import { validateSolution as zipSolutionValidator } from "./zip/solution";
const CANONICAL_PAYLOADS = {
  anagram: anagramPayload,
  classification: classificationPayload,
  "connect-pairs": connectPairsPayload,
  escape: escapePayload,
  estimation: estimationPayload,
  "heat-map": heatMapPayload,
  "logic-code": logicCodePayload,
  "logic-matrix": logicMatrixPayload,
  matching: matchingPayload,
  "mini-wordle": miniWordlePayload,
  "multiple-choice": multipleChoicePayload,
  "odd-one-out": oddOneOutPayload,
  ordering: orderingPayload,
  "progressive-clues": progressiveCluesPayload,
  "progressive-image": progressiveImagePayload,
  queens: queensPayload,
  "short-text": shortTextPayload,
  "true-false": trueFalsePayload,
  "word-hashtag": wordHashtagPayload,
  "word-search": wordSearchPayload,
  zip: zipPayload,
};
type StoredQuestionReadContext = StoredQuestionContext & { questionVersionId: QuestionVersionId };
function canonicalTags(value: unknown): QuestionTagSet {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const values = (key: string) => (Array.isArray(record[key]) ? record[key] : []);
  return {
    domains: values("domains") as QuestionTagSet["domains"],
    topics: values("topics") as QuestionTagSet["topics"],
    cognitiveSkills: values("cognitiveSkills") as QuestionTagSet["cognitiveSkills"],
    formatSkills: values("formatSkills") as QuestionTagSet["formatSkills"],
    lifeSkills: values("lifeSkills") as QuestionTagSet["lifeSkills"],
  };
}
function canonicalPublicPayload(context: StoredQuestionReadContext): unknown {
  const payload = { ...(context.publicPayload as Record<string, unknown>) };
  for (const key of ["id", "question", "prompt", "category", "tags", "context", "timeLimitMs"])
    delete payload[key];
  return CANONICAL_PAYLOADS[context.questionType as CompetitiveQuestionType](payload);
}
function canonicalSolutionPayload(
  context: StoredQuestionReadContext,
  resolved: ResolvedQuestion,
): unknown {
  const raw = context.solutionPayload as Record<string, unknown>;
  const payload = { ...raw };
  delete payload.explanation;
  if (context.questionType === "mini-wordle") {
    const question = resolved as MiniWordleQuestion;
    return {
      ...payload,
      correctAnswer: question.correctAnswer,
      ...(question.additionalGuesses ? { additionalGuesses: question.additionalGuesses } : {}),
      ...(question.dictionaryId ? { dictionaryId: question.dictionaryId } : {}),
    };
  }
  return payload;
}
function canonicalResolution(
  context: StoredQuestionReadContext,
  resolved: ResolvedQuestion,
): StoredQuestionResolution {
  const publicPayload = context.publicPayload as Record<string, unknown>;
  const solutionPayload = context.solutionPayload as Record<string, unknown>;
  const publicQuestion = {
    id: context.questionVersionId,
    type: context.questionType,
    category: typeof publicPayload.category === "string" ? publicPayload.category : "",
    tags: canonicalTags(publicPayload.tags),
    prompt:
      typeof (publicPayload.question ?? publicPayload.prompt) === "string"
        ? (publicPayload.question ?? publicPayload.prompt)
        : "",
    context: typeof publicPayload.context === "string" ? publicPayload.context : null,
    timeLimitMs: context.timeLimitMs,
    payload: canonicalPublicPayload(context),
  } as PublicQuestion;
  const solution = {
    questionVersionId: context.questionVersionId,
    type: context.questionType,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    payload: canonicalSolutionPayload(context, resolved),
  } as QuestionSolution;
  const reveals =
    context.questionType === "progressive-clues" && Array.isArray(publicPayload.clues)
      ? publicPayload.clues.map(
          (clue, clueIndex) =>
            ({
              questionVersionId: context.questionVersionId,
              type: "progressive-clues",
              payload: { clueIndex, clue },
            }) as QuestionReveal,
        )
      : undefined;
  return {
    publicQuestion,
    solution,
    points: context.itemPoints,
    ...(reveals ? { reveals } : {}),
  };
}
export function readResolvedStoredQuestion(context: StoredQuestionContext): ResolvedQuestion {
  const capability = competitiveCapabilityFor(context.questionType, context.mode);
  if (
    capability === null ||
    !capability.payloadSchemaVersions.includes(context.payloadSchemaVersion) ||
    context.itemConfigSchemaVersion !== 1 ||
    context.modeConfigSchemaVersion !== 1
  ) {
    throw new FormatValidationError("unsupported_question");
  }
  if (
    !context.publicPayload ||
    typeof context.publicPayload !== "object" ||
    Array.isArray(context.publicPayload)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  if (
    !context.solutionPayload ||
    typeof context.solutionPayload !== "object" ||
    Array.isArray(context.solutionPayload)
  ) {
    throw new FormatValidationError("invalid_question_solution");
  }
  if (
    !context.itemConfig ||
    typeof context.itemConfig !== "object" ||
    Array.isArray(context.itemConfig) ||
    !context.modeConfig ||
    typeof context.modeConfig !== "object" ||
    Array.isArray(context.modeConfig)
  ) {
    throw new FormatValidationError("invalid_question_config");
  }

  const publicPayload = context.publicPayload as Record<string, unknown>;
  const solutionPayload = context.solutionPayload as Record<string, unknown>;
  const prompt = publicPayload.question ?? publicPayload.prompt;
  if (typeof prompt !== "string") {
    throw new FormatValidationError("invalid_question_payload");
  }

  const publicResult = STORED_PUBLIC_VALIDATORS[context.questionType as CompetitiveQuestionType](
    publicPayload,
    {
      payloadSchemaVersion: context.payloadSchemaVersion,
      timeLimitMs: context.timeLimitMs,
      profile: "published",
      publicRepresentation: context.publicRepresentation,
    },
  );
  if (!publicResult.ok) throw new FormatValidationError("invalid_question_payload");
  const solutionResult = FORMAT_SOLUTION_VALIDATORS[
    context.questionType as CompetitiveQuestionType
  ](context, publicResult.value as Record<string, unknown>, solutionPayload);
  if (!solutionResult.ok) throw new FormatValidationError("invalid_question_solution");
  return solutionResult.value;
}
export function readStoredQuestion(context: StoredQuestionReadContext): StoredQuestionResolution {
  return canonicalResolution(context, readResolvedStoredQuestion(context));
}
export function validateStoredQuestion(context: StoredQuestionReadContext) {
  return validationResult("question", () => readStoredQuestion(context));
}

export const FORMAT_SOLUTION_VALIDATORS = {
  anagram: anagramSolutionValidator,
  classification: classificationSolutionValidator,
  "connect-pairs": connectPairsSolutionValidator,
  escape: escapeSolutionValidator,
  estimation: estimationSolutionValidator,
  "heat-map": heatMapSolutionValidator,
  "logic-code": logicCodeSolutionValidator,
  "logic-matrix": logicMatrixSolutionValidator,
  matching: matchingSolutionValidator,
  "mini-wordle": miniWordleSolutionValidator,
  "multiple-choice": multipleChoiceSolutionValidator,
  "odd-one-out": oddOneOutSolutionValidator,
  ordering: orderingSolutionValidator,
  "progressive-clues": progressiveCluesSolutionValidator,
  "progressive-image": progressiveImageSolutionValidator,
  queens: queensSolutionValidator,
  "short-text": shortTextSolutionValidator,
  "true-false": trueFalseSolutionValidator,
  "word-hashtag": wordHashtagSolutionValidator,
  "word-search": wordSearchSolutionValidator,
  zip: zipSolutionValidator,
} satisfies Record<
  CompetitiveQuestionType,
  (
    context: StoredQuestionContext,
    publicPayload: Record<string, unknown>,
    solution: unknown,
  ) => ReturnType<typeof validationResult<ResolvedQuestion>>
>;
