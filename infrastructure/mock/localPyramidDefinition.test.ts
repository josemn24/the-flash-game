import { expect, it } from "vitest";
import { mockDomainStore } from "@/data/mock/store";
import { createMockLocalPyramidDefinition } from "./localPyramidDefinition";
import { testDictionaries } from "@/test-utils/game-session-conformance/corpus";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";

it("builds local authority definitions from canonical published mock questions without legacy practice projections", () => {
  const versions = new Set(
    mockDomainStore.challengeVersions.filter((v) => v.mode === "pyramid").map((v) => v.id),
  );
  const publications = mockDomainStore.scheduledChallenges.filter((p) =>
    versions.has(p.challengeVersionId),
  );
  expect(publications.length).toBeGreaterThan(0);
  for (const publication of publications) {
    const definition = createMockLocalPyramidDefinition(publication.id);
    expect(definition.levels).toHaveLength(7);
    expect(() =>
      createLocalPyramidSessionProvider({ definition, dictionaries: testDictionaries }),
    ).not.toThrow();
  }
});
