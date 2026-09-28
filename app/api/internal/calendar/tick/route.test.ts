import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runCalendarTick: vi.fn() }));
vi.mock("@/server/admin-calendar", () => ({ runCalendarTick: mocks.runCalendarTick }));

import { GET, POST } from "./route";

const originalCronSecret = process.env.CRON_SECRET;
const originalCalendarTickSecret = process.env.CALENDAR_TICK_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalCalendarTickSecret === undefined) delete process.env.CALENDAR_TICK_SECRET;
  else process.env.CALENDAR_TICK_SECRET = originalCalendarTickSecret;
});

describe("calendar tick route", () => {
  it("executes the Vercel cron contract with CRON_SECRET", async () => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.runCalendarTick.mockResolvedValue({
      runId: "run-123",
      evaluatedAt: "2026-09-28T00:05:00.000Z",
      opened: 1,
      closed: 2,
      finishedSeasons: 0,
    });

    const response = await GET(
      new Request("http://localhost/api/internal/calendar/tick", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ runId: "run-123", opened: 1, closed: 2 });
    expect(mocks.runCalendarTick).toHaveBeenCalledOnce();
  });

  it("returns unavailable when the Vercel cron secret is missing", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost/api/internal/calendar/tick"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "calendar_tick_unavailable" });
    expect(mocks.runCalendarTick).not.toHaveBeenCalled();
  });

  it("rejects an invalid Vercel cron secret", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const response = await GET(
      new Request("http://localhost/api/internal/calendar/tick", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authorized" });
    expect(mocks.runCalendarTick).not.toHaveBeenCalled();
  });

  it("preserves the manual POST contract with CALENDAR_TICK_SECRET", async () => {
    process.env.CALENDAR_TICK_SECRET = "local-secret";
    mocks.runCalendarTick.mockResolvedValue({
      runId: "run-local",
      evaluatedAt: "2026-09-28T00:05:00.000Z",
      opened: 0,
      closed: 0,
      finishedSeasons: 1,
    });

    const response = await POST(
      new Request("http://localhost/api/internal/calendar/tick", {
        method: "POST",
        headers: { authorization: "Bearer local-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ runId: "run-local", finishedSeasons: 1 });
    expect(mocks.runCalendarTick).toHaveBeenCalledOnce();
  });
});
