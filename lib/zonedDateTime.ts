export type LocalDateTimeParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Missing ${type} in formatted date.`);
  return Number(value);
}

export function getLocalDateTimeParts(date: Date, timeZone: string): LocalDateTimeParts {
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

function partsToComparableUtc(parts: LocalDateTimeParts) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.getTime();
}

function isValidLocalDateTimeParts(parts: LocalDateTimeParts) {
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    return false;
  }

  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day &&
    date.getUTCHours() === parts.hour &&
    date.getUTCMinutes() === parts.minute &&
    date.getUTCSeconds() === parts.second
  );
}

/**
 * Converts a wall-clock value in an IANA zone to the first matching UTC instant.
 * A DST gap is rejected because the round-trip does not preserve the requested value.
 */
export function getUtcForLocalDateTime(parts: LocalDateTimeParts, timeZone: string) {
  if (!isValidTimeZone(timeZone)) throw new Error("Invalid IANA time zone.");
  if (!isValidLocalDateTimeParts(parts)) throw new Error("Invalid local date-time.");

  const targetAsUtc = partsToComparableUtc(parts);
  const matchingCandidates: number[] = [];
  const probes = [
    targetAsUtc - 48 * 60 * 60 * 1000,
    targetAsUtc,
    targetAsUtc + 48 * 60 * 60 * 1000,
  ];

  for (const probe of probes) {
    const actual = getLocalDateTimeParts(new Date(probe), timeZone);
    const offset = probe - partsToComparableUtc(actual);
    const candidate = targetAsUtc + offset;
    if (
      partsToComparableUtc(getLocalDateTimeParts(new Date(candidate), timeZone)) === targetAsUtc
    ) {
      matchingCandidates.push(candidate);
    }
  }

  if (matchingCandidates.length === 0) {
    throw new Error("The local date-time does not exist in the selected time zone.");
  }
  return new Date(Math.min(...matchingCandidates));
}

export function localDateTimeToUtc(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid local date-time.");

  const parts: LocalDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
  if (!isValidLocalDateTimeParts(parts)) throw new Error("Invalid local date-time.");
  const candidate = getUtcForLocalDateTime(parts, timeZone);
  if (Number.isNaN(candidate.getTime())) throw new Error("Invalid local date-time.");
  return candidate;
}

export function utcToLocalDateTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid UTC date-time.");
  const parts = getLocalDateTimeParts(date, timeZone);
  return (
    [
      String(parts.year).padStart(4, "0"),
      String(parts.month).padStart(2, "0"),
      String(parts.day).padStart(2, "0"),
    ].join("-") + `T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  );
}
