import "server-only";

import { createHmac } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/config";

export class SuperadminAuthAdminError extends Error {
  readonly code:
    "email_already_registered" | "password_rejected" | "auth_unavailable" | "idempotency_conflict";

  constructor(code: SuperadminAuthAdminError["code"], options?: ErrorOptions) {
    super(code, options);
    this.name = "SuperadminAuthAdminError";
    this.code = code;
  }
}

function createAuthAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function inputFingerprint(input: {
  email: string;
  password: string;
  displayName: string;
  idempotencyKey: string;
}) {
  return createHmac("sha256", getSupabaseServiceRoleKey())
    .update(
      JSON.stringify([input.email, input.password, input.displayName, input.idempotencyKey]),
      "utf8",
    )
    .digest("hex");
}

async function findAuthUserByEmail(email: string) {
  const client = createAuthAdminClient();
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new SuperadminAuthAdminError("auth_unavailable", { cause: error });
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

function isRetryOfSameCreation(
  user: Awaited<ReturnType<typeof findAuthUserByEmail>>,
  idempotencyKey: string,
  fingerprint: string,
) {
  if (!user || typeof user.app_metadata !== "object" || !user.app_metadata) return false;
  const operation = user.app_metadata.superadmin_user_creation;
  return (
    typeof operation === "object" &&
    operation !== null &&
    operation.idempotency_key === idempotencyKey &&
    operation.input_fingerprint === fingerprint
  );
}

function wasCreatedByOperation(
  user: Awaited<ReturnType<typeof findAuthUserByEmail>>,
  idempotencyKey: string,
) {
  if (!user || typeof user.app_metadata !== "object" || !user.app_metadata) return false;
  const operation = user.app_metadata.superadmin_user_creation;
  return (
    typeof operation === "object" &&
    operation !== null &&
    operation.idempotency_key === idempotencyKey
  );
}

/** Creates an Auth user without sending email, or recovers the same keyed operation. */
export async function createOrRecoverSuperadminAuthUser(input: {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly idempotencyKey: string;
}) {
  const fingerprint = inputFingerprint(input);
  const client = createAuthAdminClient();
  const existing = await findAuthUserByEmail(input.email);
  if (existing) {
    if (isRetryOfSameCreation(existing, input.idempotencyKey, fingerprint)) return existing.id;
    if (wasCreatedByOperation(existing, input.idempotencyKey)) {
      throw new SuperadminAuthAdminError("idempotency_conflict");
    }
    throw new SuperadminAuthAdminError("email_already_registered");
  }

  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
    app_metadata: {
      superadmin_user_creation: {
        idempotency_key: input.idempotencyKey,
        input_fingerprint: fingerprint,
      },
    },
  });
  if (!error && data.user) return data.user.id;

  // Auth and Postgres cannot share a transaction. If the request reached Auth
  // but its response was lost, a retry finds the account by its server-only
  // provisioning marker and continues without creating a second account.
  const recovered = await findAuthUserByEmail(input.email).catch(() => null);
  if (recovered && isRetryOfSameCreation(recovered, input.idempotencyKey, fingerprint))
    return recovered.id;
  if (recovered && wasCreatedByOperation(recovered, input.idempotencyKey)) {
    throw new SuperadminAuthAdminError("idempotency_conflict", { cause: error });
  }
  if (
    error?.code === "email_exists" ||
    error?.message.toLowerCase().includes("already registered")
  ) {
    throw new SuperadminAuthAdminError("email_already_registered", { cause: error });
  }
  if (error?.code === "weak_password") {
    throw new SuperadminAuthAdminError("password_rejected", { cause: error });
  }
  throw new SuperadminAuthAdminError("auth_unavailable", { cause: error });
}
