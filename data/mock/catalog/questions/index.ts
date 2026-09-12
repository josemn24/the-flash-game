import { abrahamicQuestions } from "@/data/mock/catalog/questions/abrahamic";
import { alphabetAnimalsQuestions } from "@/data/mock/catalog/questions/alphabetAnimals";
import { antarcticaQuestions } from "@/data/mock/catalog/questions/antarctica";
import { coreQuestions } from "@/data/mock/catalog/questions/core";
import { pyramidQuestions } from "@/data/mock/catalog/questions/pyramid";
import { spainSurvivalQuestions } from "@/data/mock/catalog/questions/spainSurvival";
import { steelBallRunQuestions } from "@/data/mock/catalog/questions/steelBallRun";

export type { MockPublishedQuestion } from "@/data/mock/catalog/questions/definition";

export const publishedQuestionFixtures = [
  ...coreQuestions,
  ...steelBallRunQuestions,
  ...alphabetAnimalsQuestions,
  ...spainSurvivalQuestions,
  ...antarcticaQuestions,
  ...pyramidQuestions,
  ...abrahamicQuestions,
] as const;

export type QuestionSlug = (typeof publishedQuestionFixtures)[number]["slug"];
