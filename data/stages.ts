import { connectionsStage } from "@/data/connectionsStage";
import { demoStage } from "@/data/demoStage";
import type { Stage } from "@/types/game";

export const stages: Stage[] = [demoStage, connectionsStage];

export function getStageById(id: string) {
  return stages.find((stage) => stage.id === id);
}
