import type { SeasonMeasurementSources } from "@/types/contracts/room-measurement";

export function seasonSources(): SeasonMeasurementSources {
  const season = {
    seasonId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Primera",
    status: "active" as const,
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-11-01T00:00:00Z",
  };
  return {
    roomId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    roomTitle: "Sala",
    season,
    seasons: [season],
    startedAt: "2026-10-01T00:00:00Z",
    generatedAt: "2026-10-24T00:00:00Z",
    participants: [
      { playerId: "alice", displayName: "=Alice", historyFrom: season.startsAt },
      { playerId: "bob", displayName: "Bob", historyFrom: "2026-10-02T12:00:00Z" },
    ],
    publications: [1, 2].map((n) => ({
      publicationId: `d${n}`,
      number: n,
      title: `Desafío ${n}`,
      status: "closed",
      opensAt: `2026-10-0${n}T00:00:00Z`,
      closesAt: `2026-10-0${n + 1}T00:00:00Z`,
      historyFrom: season.startsAt,
    })),
    attempts: [
      {
        id: "a1",
        playerId: "alice",
        publicationId: "d1",
        kind: "competitive",
        status: "completed",
        score: 0,
        startedAt: "2026-10-01T12:00:00Z",
        completedAt: "2026-10-01T12:01:00Z",
      },
      {
        id: "a2",
        playerId: "alice",
        publicationId: "d2",
        kind: "competitive",
        status: "abandoned",
        score: null,
        startedAt: "2026-10-02T12:00:00Z",
        completedAt: "2026-10-02T12:01:00Z",
      },
      {
        id: "t1",
        playerId: "bob",
        publicationId: "d2",
        kind: "test",
        status: "completed",
        score: 100,
        startedAt: "2026-10-02T13:00:00Z",
        completedAt: "2026-10-02T13:01:00Z",
      },
    ],
    events: [
      { playerId: "alice", publicationId: null, type: "room_viewed", count: 2 },
      { playerId: "bob", publicationId: "d2", type: "rehearsal_completed", count: 1 },
    ],
    ratings: [{ playerId: "alice", publicationId: "d1", value: 4 }],
  };
}
