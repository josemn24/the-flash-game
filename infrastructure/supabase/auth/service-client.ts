import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "../config";
import type { Database } from "../database.types";
import { serviceRpcError } from "../serviceRpcError";

export function createServiceClient() {
  try {
    return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch (error) {
    throw serviceRpcError(error);
  }
}
