import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_DEADLINE_HEADER, AUTH_FAILURE_HEADER } from "./auth-availability";
import { createClient } from "./server";
import { syntheticSession } from "@/test-utils/supabase-session";

const mocks = vi.hoisted(() => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers, cookies: mocks.cookies }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-key");
  mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
  mocks.headers.mockResolvedValue(new Headers());
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server Auth availability", () => {
  it.each(["connection", "service", "timeout"])(
    "propagates proxy %s without another fetch",
    async (reason) => {
      const fetcher = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetcher);
      mocks.headers.mockResolvedValue(new Headers({ [AUTH_FAILURE_HEADER]: reason }));
      await expect(createClient()).rejects.toMatchObject({ code: "auth_unavailable", reason });
      expect(fetcher).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
    },
  );

  it("uses the remaining proxy budget when the render checks Auth", async () => {
    vi.useFakeTimers();
    const { cookie } = syntheticSession(false);
    mocks.cookies.mockResolvedValue({ getAll: () => [cookie], set: vi.fn() });
    mocks.headers.mockResolvedValue(
      new Headers({ [AUTH_DEADLINE_HEADER]: String(Date.now() + 1000) }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => new Promise(() => {})),
    );
    const client = await createClient();
    const assertion = expect(client.auth.getUser()).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
