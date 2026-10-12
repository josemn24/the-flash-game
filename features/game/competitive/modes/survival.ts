import type { ServerSurvivalChallenge } from "@/types/gameplay/challenge";
import { deriveSurvivalProgress } from "@/lib/gameplay/survivalProgress";
import { flashPolicy } from "./flash";
import type { ModePolicy } from "./policy";
export function survivalPolicy(challenge: ServerSurvivalChallenge): ModePolicy {
  const terminal: ModePolicy["terminal"] = (results) =>
    deriveSurvivalProgress(challenge.lives, challenge.slots.length, results).outcome !==
    "in_progress";
  return {
    ...flashPolicy({ ...challenge, mode: "flash" }),
    terminal,
    next: (state) =>
      terminal(state.results, state.questionIndex) ? { type: "complete" } : { type: "prepare" },
  };
}
