import { getLocalDateTimeParts, getUtcForLocalDateTime, type LocalDateTimeParts } from "@/lib/zonedDateTime";

const DAILY_CHALLENGE_TIME_ZONE = "Europe/Madrid";

function addLocalDays(parts: LocalDateTimeParts, days: number): LocalDateTimeParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

export function getNextDailyBoundary(now = new Date(), timeZone = DAILY_CHALLENGE_TIME_ZONE) {
  const localNow = getLocalDateTimeParts(now, timeZone);
  let target = addLocalDays(localNow, 1);
  let boundary = getUtcForLocalDateTime(target, timeZone);

  while (boundary.getTime() <= now.getTime()) {
    target = addLocalDays(target, 1);
    boundary = getUtcForLocalDateTime(target, timeZone);
  }

  return boundary;
}

export function getDailyCountdownSeconds(endsAt: string | Date, now = new Date()) {
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 1000));
}

export function formatDailyCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
