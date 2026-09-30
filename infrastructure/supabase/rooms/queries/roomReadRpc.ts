import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AttemptExpirationQueries } from "@/infrastructure/supabase/attempts/attemptExpiration";
import { isRoomCalendarReadRow, isRoomReadRow } from "./roomReadGuards";

export async function callRoomRead(
  functionName:
    "get_my_room_cards" | "get_room_detail" | "get_room_introduction" | "get_room_calendar",
  args: Record<string, string> = {},
  guard: (value: unknown) => boolean = isRoomReadRow,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase room read failed (${functionName}): ${error.message}`);
  if (!Array.isArray(data)) return [];
  if (functionName === "get_room_calendar") {
    return data.map((value, index) => {
      if (!guard(value)) {
        throw new Error(`Supabase room read returned an invalid row (${functionName}, ${index})`);
      }
      return value;
    });
  }
  return data.filter(guard);
}

export async function callRankingRead<T>(
  functionName: "get_challenge_ranking" | "get_season_ranking",
  args: Record<string, string>,
  guard: (value: unknown) => value is T,
): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase ranking read failed (${functionName}): ${error.message}`);
  if (!Array.isArray(data)) {
    throw new Error(`Supabase ranking read returned an invalid payload (${functionName})`);
  }
  return data.map((value, index) => {
    if (!guard(value)) {
      throw new Error(`Supabase ranking read returned an invalid row (${functionName}, ${index})`);
    }
    return value;
  });
}

export async function callHistoryRead<T>(
  functionName: "get_room_history" | "get_room_member_review",
  args: Record<string, string | null>,
  guard: (value: unknown) => value is T,
  attemptExpiration: AttemptExpirationQueries,
): Promise<T[]> {
  await attemptExpiration.expireStaleAttemptsForRoom(String(args.target_room_slug));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(`Supabase history read failed (${functionName}): ${error.message}`);
  if (!Array.isArray(data)) {
    throw new Error(`Supabase history read returned an invalid payload (${functionName})`);
  }
  return data.map((value, index) => {
    if (!guard(value)) {
      throw new Error(`Supabase history read returned an invalid row (${functionName}, ${index})`);
    }
    return value;
  });
}
