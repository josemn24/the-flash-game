import "server-only";

export class SupabaseDatabaseUrlError extends Error {
  constructor(cause?: unknown) {
    super("database_unavailable", { cause });
    this.name = "SupabaseDatabaseUrlError";
  }
}

/**
 * Returns the configured PostgreSQL URL without changing its login role.
 *
 * Local Supabase may use `authenticator`, while the hosted transaction pooler
 * commonly supplies `postgres.<project-ref>`. The connection string itself is
 * the source of truth for that choice.
 */
export function getSupabaseDatabaseUrl() {
  const configured = process.env.SUPABASE_DB_URL;
  if (!configured) throw new SupabaseDatabaseUrlError();

  try {
    const url = new URL(configured);
    if (
      (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      !url.hostname ||
      !url.username
    ) {
      throw new Error("invalid PostgreSQL URL");
    }
  } catch (error) {
    if (error instanceof SupabaseDatabaseUrlError) throw error;
    throw new SupabaseDatabaseUrlError(error);
  }

  // Return the original value so encoded credentials and pooler parameters
  // are passed to `pg` exactly as configured, without logging them.
  return configured;
}
