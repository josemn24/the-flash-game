import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChallengesOverview } from "./ChallengesOverview";

const challenge = {
  challengeDefinitionId: "00000000-0000-4000-8000-000000000001",
  slug: "flash-beta",
  title: "Flash beta",
  subtitle: "Dos preguntas",
  description: "Desafío de prueba",
  mode: "flash" as const,
  questionCount: 2,
  versionCount: 2,
  status: "draft" as const,
  statusCounts: { draft: 1, published: 1, archived: 0 },
  updatedAt: "2026-09-20T10:00:00.000Z",
  latestVersion: {
    challengeVersionId: "00000000-0000-4000-8000-000000000002",
    versionNumber: 2,
    status: "draft" as const,
    questionCount: 2,
    updatedAt: "2026-09-20T10:00:00.000Z",
    publishedAt: null,
  },
};

describe("ChallengesOverview", () => {
  it("groups each challenge definition into a navigable card", () => {
    const markup = renderToStaticMarkup(<ChallengesOverview challenges={[challenge]} />);

    expect(markup).toContain("Desafíos");
    expect(markup).toContain("Flash beta");
    expect(markup).toContain("2 versiones");
    expect(markup).toContain('href="/admin/challenges/00000000-0000-4000-8000-000000000001"');
    expect(markup).not.toContain("solutionPayload");
  });

  it("renders a useful empty state with a create destination", () => {
    const markup = renderToStaticMarkup(<ChallengesOverview challenges={[]} />);

    expect(markup).toContain("Aún no hay desafíos Flash.");
    expect(markup).toContain('href="/admin/challenges/new"');
  });
});
