import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readPrivateHealth: vi.fn() }));
vi.mock("@/infrastructure/supabase/health", () => ({ readPrivateHealth: mocks.readPrivateHealth }));

import { GET } from "./route";

const originalSecret = process.env.HEALTHCHECK_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (originalSecret === undefined) delete process.env.HEALTHCHECK_SECRET;
  else process.env.HEALTHCHECK_SECRET = originalSecret;
});

describe("private health route", () => {
  it("does not expose health data without its secret", async () => {
    process.env.HEALTHCHECK_SECRET = "health-secret";
    const response = await GET(new Request("http://127.0.0.1:3000/api/internal/health"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "not_authorized" } });
    expect(mocks.readPrivateHealth).not.toHaveBeenCalled();
  });

  it("returns only aggregate checks with a valid secret", async () => {
    process.env.HEALTHCHECK_SECRET = "health-secret";
    mocks.readPrivateHealth.mockResolvedValue({
      ok: true,
      checks: { auth: true, database: true, schema: true },
    });

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/internal/health", {
        headers: { authorization: "Bearer health-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      checks: { auth: true, database: true, schema: true },
    });
    expect(JSON.stringify(body)).not.toMatch(/secret|password|token|jwt/i);
  });
});
