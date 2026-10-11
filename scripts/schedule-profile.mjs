export const SCHEDULE_PROFILES = Object.freeze({
  production: Object.freeze({
    name: "production",
    windowMinutes: 24 * 60,
    windowStep: 24,
    windowUnit: "hours",
    tabarniaSeasonEnd: "17 days",
    betaVipSeasonEnd: "96 hours",
  }),
  fast: Object.freeze({
    name: "fast",
    windowMinutes: 5,
    windowStep: 5,
    windowUnit: "minutes",
    tabarniaSeasonEnd: "20 minutes",
    betaVipSeasonEnd: "20 minutes",
  }),
});

export function resolveScheduleProfile(schedule = "production") {
  const profile = Object.hasOwn(SCHEDULE_PROFILES, schedule)
    ? SCHEDULE_PROFILES[schedule]
    : undefined;
  if (!profile) {
    throw new Error(
      `Perfil de calendario no válido: ${String(schedule)}. Usa "production" o "fast".`,
    );
  }
  return profile;
}

export function normalizeStartAt(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error("La fecha de inicio debe ser una fecha y hora ISO 8601 con zona horaria.");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
    value,
  );
  if (!match) {
    throw new Error(
      "La fecha de inicio debe usar ISO 8601 e incluir zona horaria, por ejemplo 2026-10-20T19:00:00+02:00.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw new Error("La fecha de inicio no es válida.");
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("La fecha de inicio no es válida.");
  return new Date(timestamp).toISOString();
}

export function validateFutureStartAt(value) {
  const normalized = normalizeStartAt(value);
  if (normalized && Date.parse(normalized) <= Date.now()) {
    throw new Error("La fecha de inicio configurada debe ser futura.");
  }
  return normalized;
}

export function scheduleStartExpression(startsAt) {
  const normalized = normalizeStartAt(startsAt);
  return normalized ? `'${normalized}'::timestamptz` : "now()";
}

export function parseScheduleArgs(args, usage) {
  let schedule = "production";
  let startsAt = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--schedule") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(usage);
      }
      schedule = value;
      index += 1;
      continue;
    }
    if (argument === "--starts-at") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(usage);
      try {
        startsAt = validateFutureStartAt(value);
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\n${usage}`,
          { cause: error },
        );
      }
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      throw new Error(usage);
    }
    throw new Error(`Argumento desconocido: ${argument}. ${usage}`);
  }
  try {
    const options = { schedule: resolveScheduleProfile(schedule).name };
    if (startsAt) options.startsAt = startsAt;
    return options;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${usage}`, {
      cause: error,
    });
  }
}

export function scheduleInterval(profile, offset, startsAt = null) {
  const duration = `${offset * profile.windowStep} ${profile.windowUnit}`;
  return `${scheduleStartExpression(startsAt)} + interval '${duration}'`;
}

export function scheduleManifest(
  profile,
  publicationCount,
  seasonDurationMinutes,
  startsAt = null,
) {
  const normalizedStartAt = normalizeStartAt(startsAt);
  return {
    scheduleProfile: profile.name,
    scheduleWindowMinutes: profile.windowMinutes,
    seasonDurationMinutes,
    ...(normalizedStartAt ? { seasonStartsAt: normalizedStartAt } : {}),
    publications: Array.from({ length: publicationCount }, (_, index) => ({
      opensAfterMinutes: index * profile.windowMinutes,
      durationMinutes: profile.windowMinutes,
      opensAfterHours: (index * profile.windowMinutes) / 60,
      durationHours: profile.windowMinutes / 60,
    })),
  };
}
