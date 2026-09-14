import type {
  AnswerValueOfType,
  PublicQuestionOfType,
  QuestionContractMap,
  QuestionSolutionOfType,
  QuestionType,
  StoredPrivateQuestionPayload,
  StoredPublicQuestionPayload,
} from "@/types/contracts";

type Assert<Value extends true> = Value;
type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type HasNoKey<Value, Key extends PropertyKey> = Key extends keyof Value ? false : true;

type EveryQuestionTypeHasContracts = Assert<IsEqual<keyof QuestionContractMap, QuestionType>>;
type PublicQuestionHasNoCorrectAnswer = Assert<
  HasNoKey<PublicQuestionOfType<"multiple-choice">["payload"], "correctAnswer">
>;
type PublicQuestionHasNoExplanation = Assert<
  HasNoKey<PublicQuestionOfType<"multiple-choice">, "explanation">
>;
type StoredPublicPayloadHasNoSchemaVersion = Assert<
  HasNoKey<StoredPublicQuestionPayload<"multiple-choice">, "payloadSchemaVersion">
>;
type StoredPrivatePayloadHasNoSchemaVersion = Assert<
  HasNoKey<StoredPrivateQuestionPayload<"multiple-choice">, "payloadSchemaVersion">
>;
type SolutionOwnsCorrectAnswer = Assert<
  "correctAnswer" extends keyof QuestionSolutionOfType<"multiple-choice">["payload"] ? true : false
>;
type ProgressiveImageDoesNotExposeSourceInitially = Assert<
  HasNoKey<PublicQuestionOfType<"progressive-image">["payload"]["surface"], "src">
>;

type QueensAnswerDoesNotFitSelection = Assert<
  AnswerValueOfType<"queens"> extends AnswerValueOfType<"multiple-choice"> ? false : true
>;
type EscapeAnswerDoesNotFitQueens = Assert<
  AnswerValueOfType<"escape"> extends AnswerValueOfType<"queens"> ? false : true
>;
type SelectionDoesNotFitEscape = Assert<
  AnswerValueOfType<"multiple-choice"> extends AnswerValueOfType<"escape"> ? false : true
>;

export type QuestionContractTypeAssertions =
  | EveryQuestionTypeHasContracts
  | PublicQuestionHasNoCorrectAnswer
  | PublicQuestionHasNoExplanation
  | StoredPublicPayloadHasNoSchemaVersion
  | StoredPrivatePayloadHasNoSchemaVersion
  | SolutionOwnsCorrectAnswer
  | ProgressiveImageDoesNotExposeSourceInitially
  | QueensAnswerDoesNotFitSelection
  | EscapeAnswerDoesNotFitQueens
  | SelectionDoesNotFitEscape;
