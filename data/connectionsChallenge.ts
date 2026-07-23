import { getQuestionsByIds, type QuestionId } from "@/data/questions";
import type { Challenge } from "@/types/game";

const connectionsChallengeQuestionIds = [
  "letter-pattern",
  "australia-capital",
  "gold-symbol",
  "italy-flag",
  "inventions-order",
  "byte-bits",
  "red-planet",
  "eiffel-tower",
  "logic-connection",
  "living-things-classification",
] satisfies QuestionId[];

export const connectionsChallenge = {
  id: "connections-challenge",
  number: 2,
  title: "Conexiones rápidas",
  subtitle: "Patrones, imágenes y cultura bajo presión",
  description:
    "Diez retos para enlazar ideas, detectar patrones y reconocer pistas antes de que se escape el tiempo.",
  mode: "flash",
  questions: getQuestionsByIds(connectionsChallengeQuestionIds),
} satisfies Challenge;
