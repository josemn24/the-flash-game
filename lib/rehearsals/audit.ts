import { competitiveQuestionTypesFor } from "@/lib/question-formats/definitions";
import type { QuestionDifficulty } from "@/types/domain/content";
import type { RehearsalBankQuestion, RehearsalMode } from "@/types/gameplay/rehearsal";
import { activeQuality, activeQuestions, latestQuestions } from "./catalog";

export const REHEARSAL_LETTERS = Array.from("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ");
export const REHEARSAL_DIFFICULTIES: readonly QuestionDifficulty[] = ["easy", "medium", "hard"];
export const REHEARSAL_MODES: readonly RehearsalMode[] = [
  "flash",
  "survival",
  "pyramid",
  "alphabet",
  "time-trial",
];

export function auditRehearsalBank(bank: readonly RehearsalBankQuestion[]) {
  const active = activeQuestions(bank);
  const combinations = REHEARSAL_MODES.flatMap((mode) =>
    competitiveQuestionTypesFor(mode).flatMap((type) =>
      (mode === "alphabet" ? REHEARSAL_LETTERS : [undefined]).flatMap((letter) =>
        REHEARSAL_DIFFICULTIES.map((difficulty) => {
          const candidates = active.filter(
            (q) =>
              q.type === type &&
              q.modes.includes(mode) &&
              q.difficulty === difficulty &&
              (!letter || q.alphabetLetter?.normalize("NFC").toLocaleUpperCase("es") === letter),
          );
          return {
            mode,
            type,
            difficulty,
            ...(letter ? { alphabetLetter: letter } : {}),
            questionCount: candidates.length,
            familyCount: new Set(candidates.map((q) => q.familyId ?? q.id)).size,
          };
        }),
      ),
    ),
  );
  const quality = activeQuality(bank);
  return {
    versions: bank.length,
    historicalVersions: bank.length - latestQuestions(bank).length,
    activeIdentities: active.length,
    retiredIdentities: latestQuestions(bank)
      .filter((q) => q.generationStatus === "retired")
      .map((q) => q.id),
    activeFamilies: new Set(active.map((q) => q.familyId ?? q.id)).size,
    ...quality,
    combinations,
    ready:
      quality.duplicates.length === 0 &&
      quality.genericExplanations.length === 0 &&
      combinations.every((c) => c.familyCount >= 1),
  };
}
