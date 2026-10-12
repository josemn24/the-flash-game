import type { ScheduledChallenge, Season } from "@/types/domain";

/** Mirrors the PostgreSQL publication_effective_status boundary for mock reads. */
export function getPublicationEffectiveStatus(
  publication: ScheduledChallenge,
  season: Season,
  now: Date,
): "upcoming" | "available" | "closed" | "cancelled" {
  if (publication.status === "cancelled") return "cancelled";
  if (publication.status === "closed" || season.status !== "active") return "closed";
  const timestamp = now.getTime();
  if (timestamp < Date.parse(season.startsAt) || timestamp < Date.parse(publication.opensAt)) {
    return "upcoming";
  }
  if (timestamp >= Date.parse(season.endsAt) || timestamp >= Date.parse(publication.closesAt)) {
    return "closed";
  }
  return "available";
}
