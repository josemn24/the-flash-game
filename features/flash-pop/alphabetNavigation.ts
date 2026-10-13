import type { AlphabetLetterStatus } from "@/features/alphabet/alphabetGame";

export type AlphabetNavigationLetter = {
  letter: string;
  status: AlphabetLetterStatus;
};

function isPending(letter: AlphabetNavigationLetter) {
  return ["unvisited", "active", "passed"].includes(letter.status);
}

export function getAlphabetNavigation(
  letters: readonly AlphabetNavigationLetter[],
  currentIndex: number | null,
  previousIndex: number | null,
) {
  const current = currentIndex === null ? null : (letters[currentIndex] ?? null);
  const previous =
    previousIndex === null || previousIndex === currentIndex
      ? null
      : (letters[previousIndex] ?? null);
  let next: AlphabetNavigationLetter | null = null;

  if (current && currentIndex !== null) {
    for (const status of ["unvisited", "passed"] as const) {
      for (let offset = 1; offset < letters.length; offset += 1) {
        const candidate = letters[(currentIndex + offset) % letters.length];
        if (candidate.status === status) {
          next = candidate;
          break;
        }
      }
      if (next) break;
    }
  }

  const correctAnswers = letters.filter((letter) => letter.status === "correct").length;
  const incorrectAnswers = letters.filter((letter) => letter.status === "incorrect").length;
  const pendingLetters = letters.filter(isPending).length;

  return {
    previous: current ? previous : null,
    current,
    next,
    correctAnswers,
    incorrectAnswers,
    pendingLetters,
    isLastPending: pendingLetters === 1 && current !== null && isPending(current),
  };
}

export function formatAlphabetProgress(
  correctAnswers: number,
  incorrectAnswers: number,
  pendingLetters: number,
) {
  return `${correctAnswers} ${correctAnswers === 1 ? "acierto" : "aciertos"} · ${incorrectAnswers} ${incorrectAnswers === 1 ? "fallo" : "fallos"} · ${pendingLetters} ${pendingLetters === 1 ? "pendiente" : "pendientes"}`;
}
