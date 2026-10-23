import "server-only";
import { randomUUID } from "node:crypto";
import { Rehearsals } from "@/application/use-cases/rehearsals";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import { rehearsalStoreFor } from "@/infrastructure/supabase/rehearsals/rehearsalStore";
import { rehearsalBank } from "@/infrastructure/rehearsals/bank";

export async function rehearsalServices() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;
  return new Rehearsals(rehearsalStoreFor(data.user.id), rehearsalBank(), randomUUID);
}
