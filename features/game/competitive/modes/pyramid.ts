import type { ServerPyramidChallenge } from "@/types/gameplay/challenge";
import { deriveCompetitivePyramidProgress } from "@/lib/gameplay/pyramidProgress";
import type { ModePolicy } from "./policy";
export function pyramidPolicy(challenge: ServerPyramidChallenge): ModePolicy {
  const terminal: ModePolicy["terminal"] = (results) =>
    deriveCompetitivePyramidProgress(challenge.levels.length, results).outcome !== "in_progress";
  return {
    initialPhase: "briefing",
    sequence: [],
    terminal,
    position: (id) => challenge.levels.findIndex((level) => level.id === id),
    next: (state) =>
      terminal(state.results, state.questionIndex)
        ? { type: "complete" }
        : { type: "phase", phase: "briefing", questionIndex: state.results.length, stepIndex: 0 },
    recover: (state, response) =>
      response.phase === "briefing"
        ? { type: "phase", phase: "briefing", questionIndex: state.results.length, stepIndex: 0 }
        : { type: "prepare" },
  };
}
