import { expect, it } from "vitest";
import { RehearsalAssignment } from "./assignment";
import { exerciseHash } from "./hash";
import type { RehearsalBankQuestion } from "@/types/gameplay/rehearsal";

const difficulties = ["easy", "medium", "hard"] as const;
function question(id: string, rank: number): RehearsalBankQuestion {
  return {
    id,
    version: 1,
    type: "true-false",
    payloadSchemaVersion: 1,
    modes: ["flash"],
    difficulty: difficulties[rank]!,
    referenceTimeLimitMs: 1000,
    publicPayload: { question: id },
    solutionPayload: { correctAnswer: true },
  };
}

it("matches an exhaustive reference on small sparse, conflicting and rectangular graphs", () => {
  let state = 54319;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) >>> 16;
  for (let test = 0; test < 160; test++) {
    const count = 1 + (random() % 4);
    const questions = Array.from({ length: 5 }, (_, i) => question(`q${i}`, random() % 3));
    const requested = Array.from({ length: count }, () => difficulties[random() % 3]!);
    const pools = requested.map(() => questions.filter(() => random() % 3 !== 0));
    const problem = new RehearsalAssignment(pools, requested);
    function exhaustive(index: number, used: Set<string>): number {
      if (index === count) return 0;
      return Math.min(
        Infinity,
        ...problem.slots[index]!.filter((q) => !used.has(q.exercise)).map(
          (q) => q.cost + exhaustive(index + 1, new Set(used).add(q.exercise)),
        ),
      );
    }
    expect(problem.minimumCost(), `graph ${test}`).toBe(exhaustive(0, new Set()));
  }
});

it("does not count metadata or Unicode composition as another exercise", () => {
  const first = { ...question("one", 0), publicPayload: { question: "¿Es útil?" } };
  const copy = {
    ...first,
    id: "two",
    version: 3,
    familyId: "different",
    difficulty: "hard" as const,
    referenceTimeLimitMs: 5000,
    publicPayload: { question: "¿Es u\u0301til?" },
    solutionPayload: { ...first.solutionPayload, explanation: "Different explanation" },
  };
  expect(exerciseHash(first)).toBe(exerciseHash(copy));
  expect(
    new RehearsalAssignment(
      [
        [first, copy],
        [first, copy],
      ],
      ["easy", "hard"],
    ).minimumCost(),
  ).toBe(Infinity);
});
