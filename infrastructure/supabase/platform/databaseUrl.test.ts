import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseDatabaseUrl, SupabaseDatabaseUrlError } from "./databaseUrl";

const previousUrl = process.env.SUPABASE_DB_URL;

afterEach(() => {
  if (previousUrl === undefined) delete process.env.SUPABASE_DB_URL;
  else process.env.SUPABASE_DB_URL = previousUrl;
});

describe("getSupabaseDatabaseUrl", () => {
  it("preserves the pooler login role, encoded password, and parameters", () => {
    const configured =
      "postgresql://postgres.bebmthwwyiyobaiertsm:p%40ssword@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require";
    process.env.SUPABASE_DB_URL = configured;

    expect(getSupabaseDatabaseUrl()).toBe(configured);
  });

  it.each([undefined, "not-a-url", "https://example.test/db", "postgresql:///postgres"])(
    "rejects an invalid or missing URL: %s",
    (configured) => {
      if (configured === undefined) delete process.env.SUPABASE_DB_URL;
      else process.env.SUPABASE_DB_URL = configured;

      expect(() => getSupabaseDatabaseUrl()).toThrow(SupabaseDatabaseUrlError);
      expect(() => getSupabaseDatabaseUrl()).toThrow("database_unavailable");
    },
  );
});
