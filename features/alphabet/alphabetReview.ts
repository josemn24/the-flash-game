import type { AlphabetChallenge, AlphabetAnswerReview } from "@/types/game";
import type { AlphabetLetterState } from "@/features/alphabet/alphabetGame";

function reviewStatus(letter: AlphabetLetterState | undefined): AlphabetAnswerReview["status"] {
  if (letter?.status === "correct") return "correct";
  if (letter?.status === "incorrect") return "incorrect";
  return "unanswered";
}

export function buildAlphabetAnswerReviews(
  challenge: AlphabetChallenge,
  letters: AlphabetLetterState[],
): AlphabetAnswerReview[] {
  return challenge.entries.map((entry, index) => {
    const letter = letters[index];
    const status = reviewStatus(letter);

    return {
      questionId: entry.question.id,
      answer: letter?.answer ?? null,
      status,
      isCorrect: status === "correct",
    };
  });
}
