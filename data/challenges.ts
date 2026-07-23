import { demoRoom } from "@/data/demoRoom";

export const challenges = demoRoom.activeSeason.challenges;

export function getChallengeById(id: string) {
  return challenges.find((challenge) => challenge.id === id);
}
