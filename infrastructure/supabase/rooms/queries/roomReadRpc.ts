import "server-only";

import { createClient } from "@/infrastructure/supabase/auth/server-client";
import type { PublicFunctionArgs, RawRpcResponse } from "@/infrastructure/supabase/rpcTypes";
import type { AttemptExpirationQueries } from "@/infrastructure/supabase/attempts/attemptExpiration";
import { isRoomReadRow } from "./roomReadGuards";

type RoomReadFunctionName =
  "get_my_room_cards" | "get_room_detail" | "get_room_introduction" | "get_room_calendar";
type RoomReadArgs = PublicFunctionArgs<RoomReadFunctionName>;
type RankingFunctionName = "get_challenge_ranking" | "get_season_ranking";
type RankingArgs = PublicFunctionArgs<RankingFunctionName>;
type HistoryFunctionName = "get_room_history" | "get_room_member_review";
type HistoryArgs = PublicFunctionArgs<HistoryFunctionName>;

export async function callRoomRead(
  functionName: RoomReadFunctionName,
  args: RoomReadArgs = {},
  guard: (value: unknown) => boolean = isRoomReadRow,
) {
  const supabase = await createClient();
  const response = await supabase.rpc<RoomReadFunctionName, RoomReadArgs>(functionName, args);
  const { data, error } = response as RawRpcResponse<typeof response>;
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
  functionName: RankingFunctionName,
  args: RankingArgs,
  guard: (value: unknown) => value is T,
): Promise<T[]> {
  const supabase = await createClient();
  const response = await supabase.rpc<RankingFunctionName, RankingArgs>(functionName, args);
  const { data, error } = response as RawRpcResponse<typeof response>;
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
  functionName: HistoryFunctionName,
  args: HistoryArgs,
  guard: (value: unknown) => value is T,
  attemptExpiration: AttemptExpirationQueries,
): Promise<T[]> {
  await attemptExpiration.expireStaleAttemptsForRoom(String(args.target_room_slug));
  const supabase = await createClient();
  const response = await supabase.rpc<HistoryFunctionName, HistoryArgs>(functionName, args);
  const { data, error } = response as RawRpcResponse<typeof response>;
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
