import type { ChallengeDefinition } from "@/types/game";

export const challengeDefinitions = {
  "demo-challenge-definition": {
    id: "demo-challenge-definition",
    title: "Steel Ball Run: primera etapa",
    subtitle: "Carrera, ingenio y reflejos",
    description:
      "Veinte retos rápidos sin spoilers inspirados en la carrera transcontinental de Steel Ball Run.",
    mode: "flash",
    questionIds: [
      "sbr-country",
      "sbr-race-type",
      "sbr-year",
      "sbr-distance",
      "sbr-prize",
      "sbr-creator",
      "sbr-west-to-east-cities",
      "sbr-grand-canyon-state",
      "sbr-average-speed",
      "sbr-nine-stages-distance",
      "sbr-equidae-odd-one-out",
      "sbr-pony-express",
      "sbr-transcontinental-railroad",
      "sbr-anachronism",
      "sbr-horse-gaits",
      "sbr-rider-translation",
      "sbr-friction",
      "sbr-steel-composition",
      "sbr-centripetal-force",
      "sbr-shortest-route",
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
