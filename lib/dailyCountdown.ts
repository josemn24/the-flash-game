import { DAILY_CHALLENGE_TIME_ZONE } from "@/lib/dailyChallenge";

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Missing ${type} in formatted date.`);
  return Number(value);
}

function getLocalDateTimeParts(date: Date, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: getDatePart(parts, "year"),
    month: getDatePart(parts, "month"),
    day: getDatePart(parts, "day"),
    hour: getDatePart(parts, "hour"),
    minute: getDatePart(parts, "minute"),
    second: getDatePart(parts, "second"),
  };
}

function getUtcForLocalDateTime(parts: LocalDateTimeParts, timeZone: string) {
  const targetAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let guess = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getLocalDateTimeParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    guess = targetAsUtc - (actualAsUtc - guess);
  }

  return new Date(guess);
}

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

export function getNextDailyBoundary(
  now = new Date(),
  timeZone = DAILY_CHALLENGE_TIME_ZONE,
) {
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
