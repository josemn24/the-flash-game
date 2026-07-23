import { connectionsChallenge } from "@/data/connectionsChallenge";
import { demoChallenge } from "@/data/demoChallenge";
import type { Challenge } from "@/types/game";

export const challenges: Challenge[] = [demoChallenge, connectionsChallenge];

export function getChallengeById(id: string) {
  return challenges.find((challenge) => challenge.id === id);
}
