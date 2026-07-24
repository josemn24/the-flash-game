import type { ChallengeDefinition } from "@/types/game";

export const challengeDefinitions = {
  "demo-challenge-definition": {
    id: "demo-challenge-definition",
    title: "Flash 01",
    subtitle: "Sprint provisional",
    description:
      "Diez retos rápidos provisionales hasta incorporar las preguntas definitivas de Tabarnia.",
    mode: "flash",
    questionIds: [
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
    ],
  },
  "connections-challenge-definition": {
    id: "connections-challenge-definition",
    title: "Conexiones rápidas",
    subtitle: "Patrones, imágenes y cultura bajo presión",
    description:
      "Diez retos para enlazar ideas, detectar patrones y reconocer pistas antes de que se escape el tiempo.",
    mode: "flash",
    questionIds: [
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
    ],
  },
} satisfies Record<string, ChallengeDefinition>;

export type KnownChallengeDefinitionId = keyof typeof challengeDefinitions;

export function getChallengeDefinitionById(id: string) {
  return challengeDefinitions[id as KnownChallengeDefinitionId];
}
