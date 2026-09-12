import { legacyChallengeDefinitions } from "@/data/mock/legacyChallengeDefinitionAdapter";

/**
 * @deprecated Proyección de compatibilidad. La fuente editorial canónica vive en
 * `@/data/mock/catalog/challenges`.
 */
export const challengeDefinitions = legacyChallengeDefinitions;

export type KnownChallengeDefinitionId = keyof typeof challengeDefinitions;

export function getChallengeDefinitionById(id: string) {
  return challengeDefinitions[id as KnownChallengeDefinitionId];
}
