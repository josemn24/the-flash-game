import "server-only";

import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/infrastructure/supabase/auth/service-client";
import { serviceRpcError } from "@/infrastructure/supabase/serviceRpcError";

export type AttemptExpirationResult = {
  readonly runId: string;
  readonly evaluatedAt: string;
  readonly abandonedAttempts: number;
};

export interface AttemptExpirationQueries {
  expireStaleAttemptsForRoom(roomSlug: string): Promise<AttemptExpirationResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isExpirationResult(value: unknown): value is AttemptExpirationResult {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.evaluatedAt === "string" &&
    !Number.isNaN(Date.parse(value.evaluatedAt)) &&
    typeof value.abandonedAttempts === "number" &&
    Number.isSafeInteger(value.abandonedAttempts) &&
    value.abandonedAttempts >= 0
  );
}

async function runExpiration(input: {
  runId: string;
  roomSlug: string;
}): Promise<AttemptExpirationResult> {
  const { data, error, status } = await Promise.resolve(
    createServiceClient().rpc("expire_stale_attempts", { input }),
  ).catch((error: unknown) => {
    throw serviceRpcError(error);
  });
  if (error) throw serviceRpcError(error, status);
  if (!isExpirationResult(data)) throw new Error("invalid_response");
  return data;
}

export class SupabaseAttemptExpiration implements AttemptExpirationQueries {
  expireStaleAttemptsForRoom(roomSlug: string) {
    return runExpiration({ runId: `history-${randomUUID()}`, roomSlug });
  }
}

export const supabaseAttemptExpiration = new SupabaseAttemptExpiration();
