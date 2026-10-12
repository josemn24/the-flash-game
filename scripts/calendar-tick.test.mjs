import { describe, expect, it, vi } from "vitest";
import { getCalendarTickConfig, requestCalendarTick } from "./calendar-tick-client.mjs";
import { main as runCalendarTick } from "./calendar-tick.mjs";
import {
  main as runCalendarTickWatch,
  parseWatchArgs,
  runCalendarTickWatch as watchCalendarTicks,
} from "./calendar-tick-watch.mjs";

describe("calendar tick client", () => {
  it("preserves the local defaults and request contract", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"opened":1}', { status: 200 }));

    expect(getCalendarTickConfig({ CALENDAR_TICK_SECRET: "local-secret" })).toEqual({
      baseUrl: "http://localhost:3000/api/internal/calendar/tick",
      secret: "local-secret",
    });
    await expect(
      requestCalendarTick({
        baseUrl: "http://127.0.0.1:3000/api/internal/calendar/tick",
        secret: "local-secret",
        fetchImpl,
      }),
    ).resolves.toBe('{"opened":1}');
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:3000/api/internal/calendar/tick", {
      method: "POST",
      headers: { authorization: "Bearer local-secret" },
    });
  });

  it("rejects a missing secret and an HTTP failure", async () => {
    expect(() => getCalendarTickConfig({})).toThrow("CALENDAR_TICK_SECRET is required");
    await expect(
      requestCalendarTick({
        baseUrl: "http://localhost:3000/api/internal/calendar/tick",
        secret: "local-secret",
        fetchImpl: vi.fn(async () => new Response("unauthorized", { status: 401 })),
      }),
    ).rejects.toThrow("Calendar tick failed (401): unauthorized");
  });

  it("keeps the one-shot command and fails the watcher immediately without a secret", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runCalendarTick({
        env: { CALENDAR_TICK_SECRET: "local-secret" },
        fetchImpl: vi.fn(async () => new Response('{"opened":1}', { status: 200 })),
      }),
    ).resolves.toBe(0);
    await expect(runCalendarTickWatch({ args: [], env: {} })).resolves.toBe(1);

    expect(log).toHaveBeenCalledWith('{"opened":1}');
    expect(error).toHaveBeenCalledWith("CALENDAR_TICK_SECRET is required.");
    log.mockRestore();
    error.mockRestore();
  });
});

describe("calendar tick watcher", () => {
  it("uses a 60-second default and accepts a custom positive interval", () => {
    expect(parseWatchArgs([])).toEqual({ intervalSeconds: 60 });
    expect(parseWatchArgs(["--interval-seconds=300"])).toEqual({ intervalSeconds: 300 });
  });

  it.each(["0", "-1", "1.5", "abc"])("rejects invalid interval %s", (value) => {
    expect(() => parseWatchArgs([`--interval-seconds=${value}`])).toThrow(
      "entero positivo en segundos",
    );
  });

  it("runs immediately, retries after errors, and never overlaps ticks", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let releaseFirstTick;
    const firstTick = new Promise((resolve) => {
      releaseFirstTick = resolve;
    });
    const tick = vi
      .fn()
      .mockImplementationOnce(() => firstTick)
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue("ok");
    const logError = vi.fn();
    const watcher = watchCalendarTicks({
      intervalSeconds: 60,
      signal: controller.signal,
      tick,
      log: vi.fn(),
      logError,
    });

    await vi.waitFor(() => expect(tick).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(tick).toHaveBeenCalledTimes(1);

    releaseFirstTick();
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.waitFor(() => expect(tick).toHaveBeenCalledTimes(2));
    expect(logError).toHaveBeenCalledWith("temporary failure");

    await vi.advanceTimersByTimeAsync(60_000);
    await vi.waitFor(() => expect(tick).toHaveBeenCalledTimes(3));
    controller.abort();
    await watcher;
    vi.useRealTimers();
  });

  it("stops without scheduling another tick after abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const tick = vi.fn().mockResolvedValue("ok");
    const watcher = watchCalendarTicks({
      intervalSeconds: 60,
      signal: controller.signal,
      tick,
      log: vi.fn(),
    });

    await vi.waitFor(() => expect(tick).toHaveBeenCalledTimes(1));
    controller.abort();
    await watcher;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(tick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
