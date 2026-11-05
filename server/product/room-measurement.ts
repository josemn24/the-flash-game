import "server-only";
import { RoomMeasurementUseCases } from "@/application/use-cases/room-measurement";
import { supabaseRoomMeasurement } from "@/infrastructure/supabase/product/room-measurement";
import { requireSuperadmin } from "@/server/admin";

export const roomMeasurement = new RoomMeasurementUseCases(
  supabaseRoomMeasurement,
  requireSuperadmin,
);
