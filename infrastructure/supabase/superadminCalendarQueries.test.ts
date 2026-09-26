import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SuperadminAccessDeniedError,
  SuperadminCalendarCommandError,
} from "@/application/administration/errors";
import { SupabaseSuperadminCalendarQueries } from "./superadminCalendarQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));
const pgMocks = vi.hoisted(() => ({ Pool: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("pg", () => ({ Pool: pgMocks.Pool }));

const id = (last: string) => `00000000-0000-4000-8000-00000000000${last}`;
const entry = {
  scheduledChallengeId: id("1"),
  roomId: id("2"),
  roomSlug: "calendar-room",
  roomTitle: "Sala calendario",
  timeZone: "Europe/Madrid",
  seasonId: id("3"),
  seasonTitle: "Temporada calendario",
  seasonStatus: "active" as const,
  challengeVersionId: id("4"),
  challengeSlug: "flash-calendar",
  versionNumber: 1,
  challengeTitle: "Flash calendario",
  challengeSubtitle: "Dos preguntas",
  mode: "flash" as const,
  number: 1,
  status: "scheduled" as const,
  opensAt: "2026-09-16T10:00:00.000Z",
  closesAt: "2026-09-16T11:00:00.000Z",
  updatedAt: "2026-09-16T09:00:00.000Z",
};

const result = {
  scheduledChallengeId: entry.scheduledChallengeId,
  roomId: entry.roomId,
  seasonId: entry.seasonId,
  challengeVersionId: entry.challengeVersionId,
  number: entry.number,
  status: entry.status,
  opensAt: entry.opensAt,
  closesAt: entry.closesAt,
  updatedAt: entry.updatedAt,
};

describe("SupabaseSuperadminCalendarQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("reads the protected context and validates its complete projection", async () => {
    mocks.rpc.mockResolvedValue({ data: { entries: [entry] }, error: null });

    await expect(new SupabaseSuperadminCalendarQueries().getContext()).resolves.toEqual({
      entries: [entry],
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_superadmin_calendar_context");
  });

  it("limits the calendar read to the selected room when a room id is provided", async () => {
    mocks.rpc.mockResolvedValue({ data: { entries: [entry] }, error: null });

    await expect(
      new SupabaseSuperadminCalendarQueries().getContext(entry.roomId),
    ).resolves.toMatchObject({
      entries: [entry],
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_superadmin_room_calendar_context", {
      target_room_id: entry.roomId,
    });
  });

  it("uses only the administrative RPCs and marks results as Supabase sourced", async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    const queries = new SupabaseSuperadminCalendarQueries();
    const createInput = {
      idempotencyKey: "calendar-create-1",
      seasonId: entry.seasonId,
      challengeVersionId: entry.challengeVersionId,
      number: 1,
      opensAt: entry.opensAt,
      closesAt: entry.closesAt,
      reason: "Preparar calendario",
    };

    await expect(queries.createScheduledChallenge(createInput)).resolves.toEqual({
      ...result,
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("create_superadmin_scheduled_challenge", {
      input: createInput,
    });

    const updateInput = {
      idempotencyKey: "calendar-update-1",
      scheduledChallengeId: entry.scheduledChallengeId,
      expectedUpdatedAt: entry.updatedAt,
      challengeVersionId: entry.challengeVersionId,
      number: 2,
      opensAt: entry.opensAt,
      closesAt: entry.closesAt,
      reason: "Ajustar ventana",
    };
    await expect(queries.updateScheduledChallenge(updateInput)).resolves.toMatchObject({
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("update_superadmin_scheduled_challenge", {
      input: updateInput,
    });
  });

  it("maps authorization and domain errors without falling back", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not_authorized" },
    });
    await expect(
      new SupabaseSuperadminCalendarQueries().createScheduledChallenge({
        idempotencyKey: "calendar-auth-1",
        seasonId: entry.seasonId,
        challengeVersionId: entry.challengeVersionId,
        number: 1,
        opensAt: entry.opensAt,
        closesAt: entry.closesAt,
        reason: "Denied",
      }),
    ).rejects.toBeInstanceOf(SuperadminAccessDeniedError);

    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "55000", message: "schedule_overlap" },
    });
    await expect(
      new SupabaseSuperadminCalendarQueries().updateScheduledChallenge({
        idempotencyKey: "calendar-domain-1",
        scheduledChallengeId: entry.scheduledChallengeId,
        expectedUpdatedAt: entry.updatedAt,
        challengeVersionId: entry.challengeVersionId,
        number: 1,
        opensAt: entry.opensAt,
        closesAt: entry.closesAt,
        reason: "Overlap",
      }),
    ).rejects.toMatchObject({
      code: "schedule_overlap",
      name: "SuperadminCalendarCommandError",
    } satisfies Partial<SuperadminCalendarCommandError>);
  });

  it("rejects malformed context and command responses", async () => {
    mocks.rpc.mockResolvedValue({ data: { entries: [{ ...entry, timeZone: 42 }] }, error: null });
    await expect(new SupabaseSuperadminCalendarQueries().getContext()).rejects.toThrow(
      "invalid context payload",
    );

    mocks.rpc.mockResolvedValue({ data: { ...result, status: "invalid" }, error: null });
    await expect(
      new SupabaseSuperadminCalendarQueries().createScheduledChallenge({
        idempotencyKey: "calendar-invalid-1",
        seasonId: entry.seasonId,
        challengeVersionId: entry.challengeVersionId,
        number: 1,
        opensAt: entry.opensAt,
        closesAt: entry.closesAt,
        reason: "Invalid response",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("runs the tick through PostgreSQL with a local service-role transaction", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              result: {
                runId: "calendar-run-1",
                evaluatedAt: "2026-09-16T10:00:00.000Z",
                opened: 1,
                closed: 0,
                finishedSeasons: 0,
              },
            },
          ],
        })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      end: vi.fn().mockResolvedValue(undefined),
    };
    pgMocks.Pool.mockImplementation(() => pool);
    const previousUrl = process.env.SUPABASE_DB_URL;
    const configuredUrl =
      "postgresql://postgres.bebmthwwyiyobaiertsm:p%40ssword@pooler.example:6543/postgres?sslmode=require";
    process.env.SUPABASE_DB_URL = configuredUrl;

    try {
      await expect(new SupabaseSuperadminCalendarQueries().runCalendarTick()).resolves.toEqual({
        runId: "calendar-run-1",
        evaluatedAt: "2026-09-16T10:00:00.000Z",
        opened: 1,
        closed: 0,
        finishedSeasons: 0,
        source: "supabase",
      });
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_DB_URL;
      else process.env.SUPABASE_DB_URL = previousUrl;
    }

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(pgMocks.Pool).toHaveBeenCalledWith({
      connectionString: configuredUrl,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      application_name: "the-flash-game-calendar-tick",
    });
    expect(client.query).toHaveBeenNthCalledWith(2, "SET LOCAL ROLE service_role");
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "select private.run_calendar_tick_command($1::jsonb) as result",
      [expect.stringContaining('"runId"')],
    );
    expect(client.query).toHaveBeenNthCalledWith(4, "COMMIT");
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
