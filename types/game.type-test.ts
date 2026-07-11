import type { Question } from "@/types/game";

type Assert<T extends true> = T;
type IsAssignable<Source, Target> = Source extends Target ? true : false;
type IsNotAssignable<Source, Target> = IsAssignable<Source, Target> extends false
  ? true
  : false;

type ValidMultipleChoice = {
  id: "valid-choice";
  type: "multiple-choice";
  category: "Test";
  question: "Choose one";
  options: ["A", "B"];
  correctAnswer: "A";
  timeLimit: 10;
  points: 100;
  explanation: "A is correct";
};

type MultipleChoiceWithoutOptions = Omit<ValidMultipleChoice, "options">;
type TrueFalseWithStringAnswer = Omit<ValidMultipleChoice, "type" | "options"> & {
  type: "true-false";
};

export type AcceptsValidMultipleChoice = Assert<
  IsAssignable<ValidMultipleChoice, Question>
>;
export type RejectsMultipleChoiceWithoutOptions = Assert<
  IsNotAssignable<MultipleChoiceWithoutOptions, Question>
>;
export type RejectsTrueFalseWithStringAnswer = Assert<
  IsNotAssignable<TrueFalseWithStringAnswer, Question>
>;
