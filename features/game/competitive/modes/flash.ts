import type { ServerFlashChallenge } from "@/types/gameplay/challenge";
import type { ModePolicy } from "./policy";
import { questionFinalization } from "./finalization";
export function flashPolicy(challenge: ServerFlashChallenge): ModePolicy {
  return {
    finalization: questionFinalization,
    initialPhase: "countdown",
    sequence: [],
    position: (id) => challenge.slots.findIndex((slot) => slot.id === id),
    terminal: (_results, index) => index >= challenge.slots.length - 1,
    next: (state) =>
      state.results.length >= challenge.slots.length ? { type: "complete" } : { type: "prepare" },
    recover: (_state, response) =>
      response.phase === "countdown"
        ? { type: "phase", phase: "countdown", stepIndex: 0 }
        : { type: "prepare" },
  };
}
