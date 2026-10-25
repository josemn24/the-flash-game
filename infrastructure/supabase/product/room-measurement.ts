import "server-only";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import type { PublicFunctionArgs, PublicFunctionName } from "@/infrastructure/supabase/rpcTypes";
import type { RoomMeasurementGateway } from "@/application/ports/room-measurement";
import type {
  RoomMeasurementSeason,
  SeasonMeasurementSources,
} from "@/types/contracts/room-measurement";
import { uuid } from "@/lib/measurement/validation";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const isoDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

function parseSeason(value: unknown): RoomMeasurementSeason | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !uuid(value.seasonId) ||
    typeof value.title !== "string" ||
    !["draft", "scheduled", "active", "finished", "cancelled"].includes(String(value.status)) ||
    !isoDate(value.startsAt) ||
    !isoDate(value.endsAt)
  )
    throw new Error("invalid_room_measurement_response");
  return value as RoomMeasurementSeason;
}

function parseSeasonSources(value: unknown): SeasonMeasurementSources {
  const rows = (v: unknown, check: (row: Record<string, unknown>) => boolean) =>
    Array.isArray(v) && v.every((row) => isRecord(row) && check(row));
  if (
    !isRecord(value) ||
    !uuid(value.roomId) ||
    typeof value.roomTitle !== "string" ||
    !isoDate(value.generatedAt) ||
    !(value.startedAt === null || isoDate(value.startedAt)) ||
    !rows(value.seasons, (s) => {
      parseSeason(s);
      return true;
    }) ||
    !rows(
      value.participants,
      (p) => uuid(p.playerId) && typeof p.displayName === "string" && isoDate(p.historyFrom),
    ) ||
    !rows(
      value.publications,
      (p) =>
        uuid(p.publicationId) &&
        number(p.number) &&
        typeof p.title === "string" &&
        isoDate(p.opensAt) &&
        isoDate(p.closesAt) &&
        isoDate(p.historyFrom) &&
        typeof p.status === "string",
    ) ||
    !rows(
      value.attempts,
      (a) =>
        uuid(a.id) &&
        uuid(a.playerId) &&
        uuid(a.publicationId) &&
        ["competitive", "test"].includes(String(a.kind)) &&
        typeof a.status === "string" &&
        (a.score === null || typeof a.score === "number") &&
        isoDate(a.startedAt) &&
        (a.completedAt === null || isoDate(a.completedAt)),
    ) ||
    !rows(
      value.events,
      (e) =>
        uuid(e.playerId) &&
        (e.publicationId === null || uuid(e.publicationId)) &&
        typeof e.type === "string" &&
        number(e.count),
    ) ||
    !rows(
      value.ratings,
      (r) =>
        uuid(r.playerId) &&
        uuid(r.publicationId) &&
        number(r.value) &&
        r.value >= 1 &&
        r.value <= 5,
    )
  )
    throw new Error("invalid_room_measurement_response");
  parseSeason(value.season);
  return value as unknown as SeasonMeasurementSources;
}

async function rpc(name: PublicFunctionName, args: Record<string, unknown>) {
  const client = await createClient();
  const { data, error } = await client.rpc(name, args as PublicFunctionArgs<typeof name>);
  if (error) {
    if (error.code === "42501") throw new Error("not_authorized");
    throw new Error(error.message);
  }
  return data as unknown;
}

export const supabaseRoomMeasurement: RoomMeasurementGateway = {
  async season(roomId, seasonId) {
    const value = await rpc("get_superadmin_season_measurement", {
      target_room_id: roomId,
      ...(seasonId ? { target_season_id: seasonId } : {}),
    });
    return value === null ? null : parseSeasonSources(value);
  },
};
