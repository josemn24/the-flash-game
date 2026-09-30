import "server-only";

import type { SuperadminDashboardQueries } from "@/application/queries";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import type {
  SuperadminDashboardAlert,
  SuperadminDashboardModel,
  SuperadminDashboardRoom,
  SuperadminDashboardUpcomingChallenge,
} from "@/types/view-models";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DashboardPayload = Omit<SuperadminDashboardModel, "alerts" | "actions" | "source">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isDashboardRoom(value: unknown): value is SuperadminDashboardRoom {
  if (!isRecord(value)) return false;
  const activeSeason = value.activeSeason;
  return (
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.slug === "string" &&
    value.slug.trim().length > 0 &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    typeof value.timeZone === "string" &&
    value.timeZone.trim().length > 0 &&
    typeof value.seasonCount === "number" &&
    Number.isSafeInteger(value.seasonCount) &&
    value.seasonCount >= 0 &&
    (activeSeason === null ||
      (isRecord(activeSeason) &&
        typeof activeSeason.title === "string" &&
        activeSeason.title.trim().length > 0 &&
        isIsoDate(activeSeason.startsAt) &&
        isIsoDate(activeSeason.endsAt)))
  );
}

function isUpcomingChallenge(value: unknown): value is SuperadminDashboardUpcomingChallenge {
  if (!isRecord(value)) return false;
  return (
    typeof value.scheduledChallengeId === "string" &&
    uuidPattern.test(value.scheduledChallengeId) &&
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.roomTitle === "string" &&
    value.roomTitle.trim().length > 0 &&
    typeof value.seasonId === "string" &&
    uuidPattern.test(value.seasonId) &&
    typeof value.seasonTitle === "string" &&
    value.seasonTitle.trim().length > 0 &&
    typeof value.challengeVersionId === "string" &&
    uuidPattern.test(value.challengeVersionId) &&
    typeof value.challengeTitle === "string" &&
    value.challengeTitle.trim().length > 0 &&
    typeof value.number === "number" &&
    Number.isSafeInteger(value.number) &&
    value.number > 0 &&
    (value.status === "scheduled" || value.status === "open") &&
    isIsoDate(value.opensAt) &&
    isIsoDate(value.closesAt) &&
    typeof value.timeZone === "string" &&
    value.timeZone.trim().length > 0
  );
}

function isDashboardPayload(value: unknown): value is DashboardPayload {
  if (!isRecord(value) || !isRecord(value.operator) || !isRecord(value.metrics)) return false;
  const metrics = value.metrics;
  return (
    typeof value.operator.playerId === "string" &&
    uuidPattern.test(value.operator.playerId) &&
    typeof value.operator.displayName === "string" &&
    value.operator.displayName.trim().length > 0 &&
    typeof metrics.activeRooms === "number" &&
    Number.isSafeInteger(metrics.activeRooms) &&
    metrics.activeRooms >= 0 &&
    typeof metrics.activeSeasons === "number" &&
    Number.isSafeInteger(metrics.activeSeasons) &&
    metrics.activeSeasons >= 0 &&
    typeof metrics.pendingSeasons === "number" &&
    Number.isSafeInteger(metrics.pendingSeasons) &&
    metrics.pendingSeasons >= 0 &&
    typeof metrics.editorialDrafts === "number" &&
    Number.isSafeInteger(metrics.editorialDrafts) &&
    metrics.editorialDrafts >= 0 &&
    typeof metrics.upcomingChallenges === "number" &&
    Number.isSafeInteger(metrics.upcomingChallenges) &&
    metrics.upcomingChallenges >= 0 &&
    Array.isArray(value.rooms) &&
    value.rooms.every(isDashboardRoom) &&
    Array.isArray(value.upcomingChallenges) &&
    value.upcomingChallenges.every(isUpcomingChallenge)
  );
}

function dashboardAlerts(payload: DashboardPayload): SuperadminDashboardAlert[] {
  const alerts: SuperadminDashboardAlert[] = [];
  const roomsWithoutSeason = payload.rooms.filter((room) => room.activeSeason === null);

  if (payload.metrics.activeRooms === 0) {
    alerts.push({
      id: "no-active-rooms",
      tone: "warning",
      title: "No hay salas activas",
      description: "Crea una sala para empezar a preparar la beta.",
      href: "/admin/rooms",
      actionLabel: "Crear sala",
    });
  } else if (roomsWithoutSeason.length > 0) {
    alerts.push({
      id: "rooms-without-season",
      tone: "warning",
      title: `${roomsWithoutSeason.length} ${roomsWithoutSeason.length === 1 ? "sala no tiene" : "salas no tienen"} temporada activa`,
      description: "Prepara una temporada antes de programar desafíos.",
      href: "/admin/rooms",
      actionLabel: "Preparar temporada",
    });
  }

  if (payload.metrics.editorialDrafts > 0) {
    alerts.push({
      id: "editorial-drafts",
      tone: "info",
      title: `${payload.metrics.editorialDrafts} ${payload.metrics.editorialDrafts === 1 ? "borrador necesita" : "borradores necesitan"} revisión`,
      description: "Valida y publica los desafíos Flash pendientes.",
      href: "/admin/challenges",
      actionLabel: "Revisar contenido",
    });
  }

  if (payload.metrics.activeSeasons > 0 && payload.metrics.upcomingChallenges === 0) {
    alerts.push({
      id: "no-upcoming-challenges",
      tone: "warning",
      title: "No hay desafíos próximos",
      description: "Programa contenido publicado para las temporadas activas.",
      href: "/admin/rooms",
      actionLabel: "Abrir calendario",
    });
  }

  return alerts;
}

function dashboardActions() {
  return [
    { id: "create-room", label: "Crear sala", href: "/admin/rooms" },
    { id: "prepare-season", label: "Preparar temporada", href: "/admin/rooms" },
    { id: "prepare-challenge", label: "Preparar desafío", href: "/admin/challenges" },
    { id: "schedule-challenge", label: "Programar desafío", href: "/admin/rooms" },
  ] as const;
}

export class SupabaseSuperadminDashboardQueries implements SuperadminDashboardQueries {
  async getDashboard(): Promise<SuperadminDashboardModel> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_dashboard_context");

    if (error) {
      if (error.code === "42501" || error.message.includes("not_authorized")) {
        throw new SuperadminAccessDeniedError();
      }
      throw new Error(`Supabase dashboard read failed: ${error.message}`);
    }
    if (!isDashboardPayload(data)) {
      throw new Error("Supabase dashboard read returned an invalid payload.");
    }

    return {
      ...data,
      alerts: dashboardAlerts(data),
      actions: [...dashboardActions()],
      source: "supabase",
    };
  }
}

export const supabaseSuperadminDashboardQueries = new SupabaseSuperadminDashboardQueries();
