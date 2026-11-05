import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomDailyLeaderboardEntry } from "@/types/view-models/room";
import { RoomLeaderboard } from "./RoomLeaderboard";

const entries: RoomDailyLeaderboardEntry[] = [1, 2, 3, 4].map((rank) => ({
  memberId: `player-${rank}`,
  name: `Player ${rank}`,
  initials: `P${rank}`,
  flashPoints: 50 - rank,
  rank,
  completed: true,
  durationMs: rank * 1000,
  startedAt: "2026-10-29T12:00:00.000Z",
}));

function renderLeaderboard({
  daily = false,
  variant = "rows",
  memberHrefBase,
}: { daily?: boolean; variant?: "rows" | "cards"; memberHrefBase?: string } = {}) {
  return renderToStaticMarkup(
    <RoomLeaderboard
      title="Ranking"
      entries={entries}
      currentUserId="current-player"
      daily={daily}
      variant={variant}
      memberHrefBase={memberHrefBase}
    />,
  );
}

describe("RoomLeaderboard medals", () => {
  it("uses the matching medals for the first three daily card positions and keeps #4", () => {
    const markup = renderLeaderboard({
      daily: true,
      variant: "cards",
      memberHrefBase: "/salas/demo/ranking",
    });

    expect(markup).toContain("first-place.svg");
    expect(markup).toContain("second-place.svg");
    expect(markup).toContain("third-place.svg");
    expect(markup).toContain("#4");
    expect(markup).not.toContain("#1");
    expect(markup).not.toContain("#2");
    expect(markup).not.toContain("#3");
    expect(markup).toContain('aria-label="Puesto 1. Ver detalle de Player 1, 49 Flash Points"');
  });

  it.each([
    ["historical challenge rows", true, "rows"],
    ["season rows", false, "rows"],
    ["non-daily cards", false, "cards"],
  ] as const)("keeps numeric ranks for %s", (_label, daily, variant) => {
    const markup = renderLeaderboard({ daily, variant });

    expect(markup).not.toContain("/visuals/medals/");
    if (variant === "cards") {
      expect(markup).toContain("#1");
      expect(markup).toContain("#4");
      return;
    }

    expect(markup).toContain(">1</span>");
    expect(markup).toContain(">4</span>");
  });
});
