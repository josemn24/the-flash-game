import { getQuestionsByIds, type QuestionId } from "@/data/questions";
import type { Challenge } from "@/types/game";

const demoChallengeQuestionIds = [
  "capital-canada",
  "sound-space",
  "war-year",
  "japan-flag",
  "olympic-rings",
  "avatar-director",
  "saturn-rings",
  "mercury-hot",
  "queen-song",
  "sequence",
] satisfies QuestionId[];

export const demoChallenge = {
  id: "demo-challenge",
  number: 1,
  title: "Desafío Demo",
  subtitle: "Sprint de prueba",
  description: "Diez retos rápidos para medir reflejos, memoria y sangre fría.",
  mode: "flash",
  questions: getQuestionsByIds(demoChallengeQuestionIds),
} satisfies Challenge;
