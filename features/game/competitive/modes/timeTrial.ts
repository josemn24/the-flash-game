import type { ServerTimeTrialChallenge } from "@/types/gameplay/challenge";
import type { ModePolicy } from "./policy";

export function timeTrialPolicy(challenge: ServerTimeTrialChallenge): ModePolicy {
  const terminal: ModePolicy["terminal"] = (results) =>
    results.some((result) => result.status !== "correct") ||
    results.length === challenge.slots.length;
  return {
    initialPhase: "countdown",
    sequence: [],
    position: (id) => challenge.slots.findIndex((slot) => slot.id === id),
    terminal,
    next: (state) =>
      terminal(state.results, state.questionIndex) ? { type: "complete" } : { type: "prepare" },
    recover: () => ({ type: "prepare" }),
  };
}
