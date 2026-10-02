import type { ServerAlphabetChallenge } from "@/types/gameplay/challenge";
import type { ModePolicy } from "./policy";
export function alphabetPolicy(challenge: ServerAlphabetChallenge): ModePolicy {
  return {
    initialPhase: "countdown",
    sequence: [],
    position: (id) => challenge.entries.findIndex((entry) => entry.id === id),
    terminal: (results) => results.length >= challenge.entries.length,
    next: (state) =>
      state.results.length >= challenge.entries.length ? { type: "complete" } : { type: "prepare" },
    recover: () => ({ type: "prepare" }),
  };
}
