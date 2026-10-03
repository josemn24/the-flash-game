export const SCHEDULE_PROFILES = Object.freeze({
  production: Object.freeze({
    name: "production",
    windowMinutes: 24 * 60,
    windowStep: 24,
    windowUnit: "hours",
    tabarniaSeasonEnd: "17 days",
    betaVipSeasonEnd: "72 hours",
  }),
  fast: Object.freeze({
    name: "fast",
    windowMinutes: 5,
    windowStep: 5,
    windowUnit: "minutes",
    tabarniaSeasonEnd: "20 minutes",
    betaVipSeasonEnd: "15 minutes",
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

export function parseScheduleArgs(args, usage) {
  let schedule = "production";
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
    if (argument === "--help" || argument === "-h") {
      throw new Error(usage);
    }
    throw new Error(`Argumento desconocido: ${argument}. ${usage}`);
  }
  try {
    return { schedule: resolveScheduleProfile(schedule).name };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${usage}`, {
      cause: error,
    });
  }
}

export function scheduleInterval(profile, offset) {
  return `now() + interval '${offset * profile.windowStep} ${profile.windowUnit}'`;
}

export function scheduleManifest(profile, publicationCount, seasonDurationMinutes) {
  return {
    scheduleProfile: profile.name,
    scheduleWindowMinutes: profile.windowMinutes,
    seasonDurationMinutes,
    publications: Array.from({ length: publicationCount }, (_, index) => ({
      opensAfterMinutes: index * profile.windowMinutes,
      durationMinutes: profile.windowMinutes,
      opensAfterHours: (index * profile.windowMinutes) / 60,
      durationHours: profile.windowMinutes / 60,
    })),
  };
}
