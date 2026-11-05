import type {
  RoomMeasurementMetricTotals,
  SeasonMeasurementReport,
  SeasonMeasurementSources,
} from "@/types/contracts/room-measurement";
import { csvCell } from "@/lib/measurement/csv";

export const seasonMetricLabels = {
  roomVisits: "Visitas a la sala",
  challengeOpens: "Aperturas de desafío",
  competitiveStarts: "Partidas iniciadas",
  competitiveCompletions: "Partidas finalizadas",
  returningPeople: "Personas que vuelven",
  rankingViews: "Visitas al ranking",
  reviewViews: "Revisiones consultadas",
  practiceStarts: "Prácticas iniciadas",
  practiceCompletions: "Prácticas finalizadas",
} satisfies Record<keyof RoomMeasurementMetricTotals, string>;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length
    ? sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2
    : null;
}

export function calculateSeasonMeasurement(
  sources: SeasonMeasurementSources,
): SeasonMeasurementReport {
  const publications = sources.publications.filter((p) => p.status !== "cancelled");
  const attemptsByPair = new Map(
    sources.attempts
      .filter((a) => a.kind === "competitive")
      .map((a) => [`${a.playerId}:${a.publicationId}`, a]),
  );
  const ratingsByPair = new Map(
    sources.ratings.map((r) => [`${r.playerId}:${r.publicationId}`, r.value]),
  );
  const cells = sources.participants.flatMap((person) =>
    publications.map((publication) => {
      const upcoming = Date.parse(publication.opensAt) > Date.parse(sources.generatedAt);
      const eligible =
        !upcoming &&
        Date.parse(publication.closesAt) >
          Math.max(Date.parse(person.historyFrom), Date.parse(publication.historyFrom));
      const attempt = attemptsByPair.get(`${person.playerId}:${publication.publicationId}`);
      return {
        playerId: person.playerId,
        publicationId: publication.publicationId,
        eligible,
        status: upcoming
          ? "upcoming"
          : eligible
            ? (attempt?.status ?? "not_started")
            : "unavailable",
        attemptId: attempt?.id ?? null,
        score: attempt?.score ?? null,
        rating: ratingsByPair.get(`${person.playerId}:${publication.publicationId}`) ?? null,
      };
    }),
  );
  function totals(playerId?: string, publicationId?: string): RoomMeasurementMetricTotals {
    const matches = (row: { playerId: string; publicationId: string | null }) =>
      (!playerId || row.playerId === playerId) &&
      (!publicationId || row.publicationId === publicationId);
    const attempts = sources.attempts.filter(matches);
    const official = attempts.filter((a) => a.kind === "competitive" && a.status !== "invalidated");
    const events = sources.events.filter(matches);
    const count = (type: string) =>
      events.filter((e) => e.type === type).reduce((n, e) => n + e.count, 0);
    // Season recurrence describes starts across publications, independently of completion.
    const returning = new Map<string, Set<string>>();
    for (const a of official) {
      const own = returning.get(a.playerId) ?? new Set<string>();
      own.add(a.publicationId);
      returning.set(a.playerId, own);
    }
    return {
      roomVisits: count("room_viewed"),
      challengeOpens: count("challenge_intro_viewed"),
      competitiveStarts: official.length,
      competitiveCompletions: official.filter((a) => a.status === "completed").length,
      returningPeople: [...returning.values()].filter((set) => set.size > 1).length,
      rankingViews: count("ranking_viewed"),
      reviewViews: count("review_viewed"),
      practiceStarts:
        count("rehearsal_started") +
        attempts.filter((a) => a.kind === "test" && a.status !== "invalidated").length,
      practiceCompletions:
        count("rehearsal_completed") +
        attempts.filter((a) => a.kind === "test" && a.status === "completed").length,
    };
  }
  const ratingStats = (rows: typeof cells) => {
    const values = rows.flatMap((c) => (c.rating === null ? [] : [c.rating]));
    return { ratingCount: values.length, enjoyment: median(values) };
  };
  return {
    sources,
    metrics: totals(),
    opportunities: cells.filter((c) => c.eligible).length,
    activePeople: new Set(
      sources.attempts
        .filter((a) => a.kind === "competitive" && a.status !== "invalidated")
        .map((a) => a.playerId),
    ).size,
    participants: sources.participants.map((p) => {
      const own = cells.filter((c) => c.playerId === p.playerId);
      return {
        ...p,
        metrics: totals(p.playerId),
        opportunities: own.filter((c) => c.eligible).length,
        ...ratingStats(own),
      };
    }),
    publications: publications.map((p) => {
      const own = cells.filter((c) => c.publicationId === p.publicationId);
      return {
        ...p,
        metrics: totals(undefined, p.publicationId),
        opportunities: own.filter((c) => c.eligible).length,
        ...ratingStats(own),
      };
    }),
    cells,
  };
}

export const SEASON_CSV_DATASETS = [
  "participants",
  "participation",
  "challenges",
  "summary",
] as const;
export type SeasonCsvDataset = (typeof SEASON_CSV_DATASETS)[number];
export function seasonMeasurementCsv(report: SeasonMeasurementReport, dataset: SeasonCsvDataset) {
  const { sources } = report;
  const metadata = {
    room_id: sources.roomId,
    season_id: sources.season?.seasonId ?? null,
    generated_at: sources.generatedAt,
    navigation_from: sources.startedAt,
  };
  const metrics = (m: RoomMeasurementMetricTotals, scope: "season" | "challenge" = "season") =>
    Object.fromEntries(
      Object.entries(m)
        // Recurrence needs multiple publications; a per-challenge zero would be misleading.
        .filter(([key]) => scope !== "challenge" || key !== "returningPeople")
        .map(([key, value]) => [seasonMetricLabels[key as keyof typeof m], value]),
    );
  let rows: Record<string, unknown>[];
  if (dataset === "participants")
    rows = report.participants.map((p) => ({
      player_id: p.playerId,
      name: p.displayName,
      history_from: p.historyFrom,
      opportunities: p.opportunities,
      ...metrics(p.metrics),
      ratings: p.ratingCount,
      enjoyment_median: p.enjoyment,
    }));
  else if (dataset === "challenges")
    rows = report.publications.map((p) => ({
      publication_id: p.publicationId,
      number: p.number,
      title: p.title,
      opens_at: p.opensAt,
      closes_at: p.closesAt,
      opportunities: p.opportunities,
      ...metrics(p.metrics, "challenge"),
      ratings: p.ratingCount,
      enjoyment_median: p.enjoyment,
    }));
  else if (dataset === "participation")
    rows = report.cells.map((c) => ({
      player_id: c.playerId,
      name: sources.participants.find((p) => p.playerId === c.playerId)?.displayName,
      publication_id: c.publicationId,
      challenge: sources.publications.find((p) => p.publicationId === c.publicationId)?.title,
      eligible: c.eligible,
      status: c.status,
      attempt_id: c.attemptId,
      score: c.score,
      enjoyment: c.rating,
    }));
  else
    rows = [
      {
        ...metrics(report.metrics),
        people: report.participants.length,
        active_people: report.activePeople,
        challenges: report.publications.length,
        opportunities: report.opportunities,
      },
    ];
  const columns = [...new Set([...Object.keys(metadata), ...rows.flatMap(Object.keys)])];
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(","),
      ...rows.map((row) => {
        const merged = { ...metadata, ...row };
        return columns.map((key) => csvCell(merged[key as keyof typeof merged])).join(",");
      }),
    ].join("\r\n") +
    "\r\n"
  );
}
