import type {
  ImageLabelingQuestion,
  MatchingQuestion,
  MultipleChoiceQuestion,
  ResolvedQuestionContractMap,
  ResolvedQuestionOfType,
} from "@/types/gameplay/scoring";
import type { QuestionContractMap, QuestionType } from "@/types/contracts";

type Assert<Value extends true> = Value;
type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type EveryResolvedQuestionTypeHasAProjection = Assert<
  IsEqual<keyof ResolvedQuestionContractMap, QuestionType>
>;
type ResolvedAndCanonicalMapsUseTheSameKeys = Assert<
  IsEqual<keyof ResolvedQuestionContractMap, keyof QuestionContractMap>
>;

type MatchingAddsThePrivateMatchId = Assert<
  IsEqual<ResolvedQuestionOfType<"matching">["leftItems"][number]["correctMatchId"], string>
>;
type MultipleChoiceKeepsTheSolutionType = Assert<
  IsEqual<ResolvedQuestionOfType<"multiple-choice">["correctAnswer"], string>
>;

type AssignAllImageLabeling = Extract<
  ResolvedQuestionOfType<"image-labeling">,
  { task: "assign-all" }
>;
type IdentifyOneImageLabeling = Extract<
  ResolvedQuestionOfType<"image-labeling">,
  { task: "identify-one" }
>;
type ImageLabelingKeepsItsDiscriminatedVariants = Assert<
  IsEqual<AssignAllImageLabeling["task"], "assign-all">
>;
type IdentifyOneKeepsItsResponse = Assert<
  IsEqual<IdentifyOneImageLabeling["task"], "identify-one">
>;

type ExistingMatchingExportRemainsStable = Assert<
  IsEqual<MatchingQuestion, ResolvedQuestionOfType<"matching">>
>;
type ExistingMultipleChoiceExportRemainsStable = Assert<
  IsEqual<MultipleChoiceQuestion, ResolvedQuestionOfType<"multiple-choice">>
>;
type ExistingImageLabelingExportRemainsStable = Assert<
  IsEqual<ImageLabelingQuestion, ResolvedQuestionOfType<"image-labeling">>
>;

export type ScoringContractTypeAssertions =
  | EveryResolvedQuestionTypeHasAProjection
  | ResolvedAndCanonicalMapsUseTheSameKeys
  | MatchingAddsThePrivateMatchId
  | MultipleChoiceKeepsTheSolutionType
  | ImageLabelingKeepsItsDiscriminatedVariants
  | IdentifyOneKeepsItsResponse
  | ExistingMatchingExportRemainsStable
  | ExistingMultipleChoiceExportRemainsStable
  | ExistingImageLabelingExportRemainsStable;
