import { afterEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "./service-client";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), cookies: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("createServiceClient", () => {
  it("uses only service credentials with session handling disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.local");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "user-key");
    createServiceClient();
    expect(mocks.createClient).toHaveBeenCalledWith("http://supabase.local", "service-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])(
    "checks %s at invocation time and reports missing configuration",
    (missing) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.local");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
      vi.stubEnv(missing, "");
      expect(createServiceClient).toThrow("database_unavailable");
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );
});
