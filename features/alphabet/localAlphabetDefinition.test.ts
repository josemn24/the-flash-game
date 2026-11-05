import { describe, expect, it } from "vitest";
import { legacyChallenges } from "@/data/mock/legacyChallengeAdapter";
import { compileAlphabetDefinition } from "@/features/game/session/providers/localShared/definition";
import { localAlphabetDefinitionFromChallenge } from "./localAlphabetDefinition";

describe("localAlphabetDefinitionFromChallenge", () => {
  it("preserves the mock challenge's 16 letters and editorial scoring weights", () => {
    const challenge = legacyChallenges.find((item) => item.mode === "alphabet");
    if (!challenge || challenge.mode !== "alphabet") throw new Error("missing Alphabet fixture");
    const definition = localAlphabetDefinitionFromChallenge(challenge);
    const compiled = compileAlphabetDefinition(definition);

    expect(compiled.definition.challenge).toMatchObject({
      id: challenge.id,
      title: challenge.title,
      mode: "alphabet",
      timeLimitMs: 150_000,
      maxScore: 100,
    });
    expect(compiled.definition.challenge.entries.map((entry) => entry.letter)).toHaveLength(16);
    expect(compiled.definition.challenge.entries.map((entry) => entry.points)).toEqual(
      challenge.entries.map((entry) => entry.points),
    );
    expect(compiled.levels).toHaveLength(16);
  });
});
