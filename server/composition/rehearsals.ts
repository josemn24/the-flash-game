import "server-only";
import { Rehearsals } from "@/application/use-cases/rehearsals";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import { rehearsalStoreFor } from "@/infrastructure/supabase/rehearsals/rehearsalStore";
import { listRehearsals, resolveRehearsal } from "@/infrastructure/rehearsals/catalog";

export async function rehearsalServices() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;
  return new Rehearsals(rehearsalStoreFor(data.user.id), {
    list: listRehearsals,
    resolve: resolveRehearsal,
  });
}

export function rehearsalPreview(id: string, version: number) {
  return listRehearsals().find((a) => a.ref.id === id && a.ref.version === version) ?? null;
}
