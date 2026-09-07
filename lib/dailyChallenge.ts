import { getChallengeDefinitionById } from "@/data/challengeDefinitions";
import { getChallengeAvailabilityStatus } from "@/lib/challengeAvailability";
import type { PlayableScheduledChallenge, Room, ScheduledChallenge } from "@/types/game";

export const DAILY_CHALLENGE_TIME_ZONE = "Europe/Madrid";

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Missing ${type} in formatted date.`);
  return value;
}

export function getDailyChallengeDateKey(now = new Date(), timeZone = DAILY_CHALLENGE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  return [getDatePart(parts, "year"), getDatePart(parts, "month"), getDatePart(parts, "day")].join(
    "-",
  );
}

function isPlayableScheduledChallenge(
  scheduledChallenge: ScheduledChallenge,
  now: Date,
): scheduledChallenge is PlayableScheduledChallenge {
  if (!("challengeDefinitionId" in scheduledChallenge)) return false;
  if (typeof scheduledChallenge.challengeDefinitionId !== "string") return false;
  if (!getChallengeDefinitionById(scheduledChallenge.challengeDefinitionId)) return false;

  return (
    getChallengeAvailabilityStatus(
      scheduledChallenge.availableFrom,
      scheduledChallenge.availableUntil,
      now,
    ) === "available"
  );
}

function hashString(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function getDailyChallenge(room: Room, now = new Date()) {
  if (room.activeSeason.status !== "active") return null;

  const candidates = room.activeSeason.scheduledChallenges
    .filter((challenge) => isPlayableScheduledChallenge(challenge, now))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (candidates.length === 0) return null;

  const dateKey = getDailyChallengeDateKey(now);
  const candidateIndex = hashString(`${room.id}:${dateKey}`) % candidates.length;

  return candidates[candidateIndex];
}
