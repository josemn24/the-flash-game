import { resolveLocalDateTime } from "@/lib/zonedDateTime";
import type { SuperadminCalendarEntry, SuperadminPortalRoom } from "@/types/view-models";
import type { CalendarChangeInput } from "@/types/view-models/calendar-change";

export type CalendarEditorRequest = {
  roomId: string;
  seasonId: string;
  expectedUpdatedAt: string;
  expectedPublications: readonly { id: string; updatedAt: string }[];
  scheduledChallengeId?: string;
  startsAtLocal: string;
  endsAtLocal: string;
  opensAtLocal: string;
  closesAtLocal: string;
  scope: "single" | "following" | "editable";
  expandSeason: boolean;
};

function micros(value: string) {
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  return BigInt(Date.parse(value)) * BigInt(1000) + BigInt(fraction.padEnd(6, "0").slice(3, 6));
}

function shift(value: string, delta: bigint) {
  if (delta === BigInt(0)) return value;
  const total = micros(value) + delta;
  const date = new Date(Number(total / BigInt(1000))).toISOString();
  return date.replace(/\.\d{3}Z$/, `.${String(total % BigInt(1_000_000)).padStart(6, "0")}Z`);
}

export function buildCalendarChange(
  request: CalendarEditorRequest,
  room: SuperadminPortalRoom,
  entries: readonly SuperadminCalendarEntry[],
): CalendarChangeInput {
  const season = room.seasons.find((candidate) => candidate.seasonId === request.seasonId);
  if (room.roomId !== request.roomId || !season || !season.updatedAt)
    throw new Error("season_not_found");
  if (season.updatedAt !== request.expectedUpdatedAt) throw new Error("schedule_conflict");
  const publications = entries
    .filter((entry) => entry.seasonId === season.seasonId)
    .sort((a, b) =>
      micros(a.opensAt) < micros(b.opensAt)
        ? -1
        : micros(a.opensAt) > micros(b.opensAt)
          ? 1
          : a.number - b.number,
    );
  if (
    publications.length !== request.expectedPublications.length ||
    publications.some(
      (entry) =>
        !request.expectedPublications.some(
          (expected) =>
            expected.id === entry.scheduledChallengeId && expected.updatedAt === entry.updatedAt,
        ),
    )
  )
    throw new Error("schedule_conflict");
  let startsAt = resolveLocalDateTime(request.startsAtLocal, room.timeZone, season.startsAt);
  let endsAt = resolveLocalDateTime(request.endsAtLocal, room.timeZone, season.endsAt);
  const target = request.scheduledChallengeId
    ? publications.find((entry) => entry.scheduledChallengeId === request.scheduledChallengeId)
    : undefined;
  if (request.scheduledChallengeId && !target) throw new Error("schedule_not_found");
  const opensAt = target
    ? resolveLocalDateTime(request.opensAtLocal, room.timeZone, target.opensAt)
    : "";
  const closesAt = target
    ? resolveLocalDateTime(request.closesAtLocal, room.timeZone, target.closesAt)
    : "";
  let selected: readonly SuperadminCalendarEntry[] = [];
  if (target)
    selected =
      request.scope === "following"
        ? publications
            .slice(publications.indexOf(target))
            .filter((entry) => entry.status !== "cancelled")
        : [target];
  else if (request.scope === "editable")
    selected = publications.filter((entry) => entry.calendarPermissions?.canEditWindow);
  const delta = target
    ? micros(opensAt) - micros(target.opensAt)
    : micros(startsAt) - micros(season.startsAt);
  const changes = selected.map((entry) => ({
    scheduledChallengeId: entry.scheduledChallengeId,
    expectedUpdatedAt: entry.updatedAt,
    opensAt: request.scope === "single" && target ? opensAt : shift(entry.opensAt, delta),
    closesAt: request.scope === "single" && target ? closesAt : shift(entry.closesAt, delta),
  }));
  if (request.expandSeason) {
    for (const entry of publications.filter((entry) => entry.status !== "cancelled")) {
      const replacement =
        changes.find((change) => change.scheduledChallengeId === entry.scheduledChallengeId) ??
        entry;
      if (micros(replacement.opensAt) < micros(startsAt)) startsAt = replacement.opensAt;
      if (micros(replacement.closesAt) > micros(endsAt)) endsAt = replacement.closesAt;
    }
  }
  return {
    seasonId: season.seasonId,
    expectedUpdatedAt: season.updatedAt,
    startsAt,
    endsAt,
    publications: changes,
  };
}

export function calendarErrorMessage(code: string) {
  const messages: Record<string, string> = {
    season_not_found: "La temporada ya no está disponible. Recarga el portal.",
    schedule_not_found: "El desafío ya no está disponible. Recarga el portal.",
    schedule_conflict: "El calendario cambió en otra pestaña. Cierra y vuelve a abrir el editor.",
    season_start_locked:
      "El inicio de la temporada está protegido porque ya abrió un desafío o existen partidas competitivas.",
    season_finished: "La temporada ha terminado y no se puede reabrir.",
    schedule_finished: "El desafío está cerrado o cancelado y no se puede reabrir.",
    opening_reached:
      "El desafío ya ha abierto. Conserva la apertura y amplía únicamente el cierre.",
    competitive_attempt_exists:
      "La publicación ya tiene partidas competitivas y su apertura está protegida.",
    schedule_overlap:
      "Hay desafíos que se solapan. Ajusta las ventanas o desplaza también los posteriores.",
    schedule_outside_season:
      "Hay desafíos fuera de la temporada. Selecciona ampliar sus límites o ajusta las fechas.",
    invalid_schedule_dates:
      "La apertura debe ser anterior al cierre y una nueva apertura publicada debe ser futura.",
    invalid_season_dates:
      "El inicio debe ser anterior al fin; la temporada publicada debe terminar en el futuro.",
    idempotency_conflict:
      "La operación ya se usó con otros datos. Cierra y vuelve a abrir el editor.",
  };
  return messages[code] ?? "No se pudo validar el calendario. Revisa las fechas y la zona horaria.";
}
