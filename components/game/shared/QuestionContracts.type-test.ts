import type { QuestionStageProps } from "@/components/game/shared/QuestionStage";
import type {
  PublicQuestion,
  PublicQuestionOfType,
  QuestionSolutionOfType,
} from "@/types/contracts";
import type { PracticeAnswerValueOfType, PracticeQuestion } from "@/types/gameplay/practice";

type Assert<Value extends true> = Value;
type IsAssignable<Source, Target> = Source extends Target ? true : false;
type IsNotAssignable<Source, Target> = IsAssignable<Source, Target> extends false ? true : false;
type HasNoKey<Value, Key extends PropertyKey> = Key extends keyof Value ? false : true;

type PracticeQuestionsStayOutOfPublicContracts = Assert<
  IsNotAssignable<PracticeQuestion, PublicQuestion>
>;
type PublicQuestionsStayOutOfPracticeStages = Assert<
  IsNotAssignable<PublicQuestion, QuestionStageProps["question"]>
>;
type PracticeStagesAcceptPracticeQuestions = Assert<
  IsAssignable<PracticeQuestion, QuestionStageProps["question"]>
>;
type PracticeAnswerIsFormatSpecific = Assert<
  IsNotAssignable<PracticeAnswerValueOfType<"queens">, PracticeAnswerValueOfType<"multiple-choice">>
>;
type PublicQuestionDoesNotExposeSolution = Assert<
  HasNoKey<PublicQuestionOfType<"multiple-choice">, "correctAnswer">
>;
type SolutionKeepsCorrectAnswerPrivate = Assert<
  "correctAnswer" extends keyof QuestionSolutionOfType<"multiple-choice">["payload"] ? true : false
>;

export type QuestionBoundaryTypeAssertions =
  | PracticeQuestionsStayOutOfPublicContracts
  | PublicQuestionsStayOutOfPracticeStages
  | PracticeStagesAcceptPracticeQuestions
  | PracticeAnswerIsFormatSpecific
  | PublicQuestionDoesNotExposeSolution
  | SolutionKeepsCorrectAnswerPrivate;
