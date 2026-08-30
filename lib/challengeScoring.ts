import type {
  FlashChallenge,
  ProgressiveCluesQuestion,
  PyramidChallenge,
  Question,
  SurvivalChallenge,
} from "@/types/game";

export const CHALLENGE_MAX_SCORE = 100;

type ChallengeQuestionPoints = NonNullable<FlashChallenge["questionPoints"]>;

export function getChallengeQuestionPointValues(
  questionCount: number,
  totalPoints = CHALLENGE_MAX_SCORE,
) {
  if (questionCount <= 0) return [];

  const basePoints = Math.floor(totalPoints / questionCount);
  const extraPointCount = totalPoints % questionCount;

  return Array.from(
    { length: questionCount },
    (_, index) => basePoints + (index < extraPointCount ? 1 : 0),
  );
}

export function getChallengeQuestionPoints(
  questionIndex: number,
  questionCount: number,
  totalPoints = CHALLENGE_MAX_SCORE,
) {
  return getChallengeQuestionPointValues(questionCount, totalPoints)[questionIndex] ?? 0;
}

export function getConfiguredChallengeQuestionPointValues(
  questionIds: string[],
  questionPoints?: ChallengeQuestionPoints,
  totalPoints = CHALLENGE_MAX_SCORE,
) {
  if (!questionPoints) return getChallengeQuestionPointValues(questionIds.length, totalPoints);

  const pointValues = questionIds.map((questionId) => questionPoints[questionId]);
  const missingQuestionIds = questionIds.filter((questionId, index) => pointValues[index] == null);
  if (missingQuestionIds.length > 0) {
    throw new Error(
      `Challenge scoring is missing points for questions: ${missingQuestionIds.join(", ")}`,
    );
  }

  const invalidQuestionIds = questionIds.filter((questionId, index) => {
    const points = pointValues[index];
    return typeof points !== "number" || !Number.isInteger(points) || points < 0;
  });
  if (invalidQuestionIds.length > 0) {
    throw new Error(
      `Challenge scoring must use non-negative integer points for questions: ${invalidQuestionIds.join(", ")}`,
    );
  }

  const total = pointValues.reduce<number>((sum, points) => sum + (points ?? 0), 0);
  if (total !== totalPoints) {
    throw new Error(`Challenge scoring must add up to ${totalPoints} points. Received ${total}.`);
  }

  return pointValues as number[];
}

function scaleProgressiveCluePenalty(question: ProgressiveCluesQuestion, challengePoints: number) {
  if (question.points <= 0 || question.cluePenalty <= 0) return 0;
  return Math.max(1, Math.round((question.cluePenalty / question.points) * challengePoints));
}

export function withChallengeQuestionPoints(question: Question, challengePoints: number): Question {
  if (question.type === "progressive-clues") {
    return {
      ...question,
      points: challengePoints,
      cluePenalty: scaleProgressiveCluePenalty(question, challengePoints),
    };
  }

  return { ...question, points: challengePoints };
}

export function withChallengeScoring<T extends FlashChallenge | SurvivalChallenge>(
  challenge: T,
): T {
  const pointValues = getConfiguredChallengeQuestionPointValues(
    challenge.questions.map((question) => question.id),
    challenge.questionPoints,
  );

  return {
    ...challenge,
    questions: challenge.questions.map((question, index) =>
      withChallengeQuestionPoints(question, pointValues[index] ?? 0),
    ),
  } as T;
}

export function withPyramidScoring(challenge: PyramidChallenge): PyramidChallenge {
  const questionIds = challenge.levels.map((level) => level.question.id);
  const pointValues = getConfiguredChallengeQuestionPointValues(
    questionIds,
    challenge.questionPoints,
  );

  return {
    ...challenge,
    levels: challenge.levels.map((level, index) => ({
      ...level,
      question: withChallengeQuestionPoints(level.question, pointValues[index] ?? 0),
    })),
  };
}
