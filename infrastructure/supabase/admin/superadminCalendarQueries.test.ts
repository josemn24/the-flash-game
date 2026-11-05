import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SuperadminAccessDeniedError,
  SuperadminCalendarCommandError,
} from "@/application/administration/errors";
import { SupabaseSuperadminCalendarQueries } from "./superadminCalendarQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  serviceRpc: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/auth/server-client", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/infrastructure/supabase/auth/service-client", () => ({
  createServiceClient: mocks.createServiceClient,
}));

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
    vi.resetAllMocks();
    mocks.createServiceClient.mockReturnValue({ rpc: mocks.serviceRpc });
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

    const cancelInput = {
      idempotencyKey: "calendar-cancel-1",
      scheduledChallengeId: entry.scheduledChallengeId,
      expectedUpdatedAt: entry.updatedAt,
      reason: "Retirar publicación",
    };
    mocks.rpc.mockResolvedValue({ data: { ...result, status: "cancelled" }, error: null });
    await expect(queries.cancelScheduledChallenge(cancelInput)).resolves.toMatchObject({
      status: "cancelled",
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("cancel_superadmin_scheduled_challenge", {
      input: cancelInput,
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

  it("runs the tick with the service RPC and preserves its contract", async () => {
    const result = {
      runId: "calendar-run-1",
      evaluatedAt: "2026-09-16T10:00:00.000Z",
      opened: 1,
      closed: 0,
      finishedSeasons: 0,
      abandonedAttempts: 2,
    };
    mocks.serviceRpc.mockResolvedValue({ data: result, error: null, status: 200 });
    await expect(new SupabaseSuperadminCalendarQueries().runCalendarTick()).resolves.toEqual({
      ...result,
      source: "supabase",
    });
    expect(mocks.serviceRpc).toHaveBeenCalledWith("run_calendar_tick", {
      input: { runId: expect.stringMatching(/^[0-9a-f-]{36}$/) },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a malformed tick response", async () => {
    mocks.serviceRpc.mockResolvedValue({ data: {}, error: null, status: 200 });
    await expect(new SupabaseSuperadminCalendarQueries().runCalendarTick()).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([
    [{ code: "22023", message: "calendar_tick_invalid" }, 400, "calendar_tick_invalid"],
    [{ code: "57014", message: "canceling statement due to statement timeout" }, 500, "57014"],
    [{ code: "PGRST202", message: "function not in schema cache" }, 404, "database_unavailable"],
    [{ code: "", message: "fetch failed" }, 0, "database_unavailable"],
    [{ code: "PGRST301", message: "invalid JWT" }, 401, "database_unavailable"],
  ])("maps tick errors without losing SQLSTATE", async (error, status, code) => {
    mocks.serviceRpc.mockResolvedValue({ data: null, error, status });
    await expect(new SupabaseSuperadminCalendarQueries().runCalendarTick()).rejects.toMatchObject({
      code,
      name: "SuperadminCalendarCommandError",
    });
  });

  it("normalizes missing service configuration", async () => {
    mocks.createServiceClient.mockImplementation(() => {
      throw Object.assign(new Error("database_unavailable"), { code: "database_unavailable" });
    });
    await expect(new SupabaseSuperadminCalendarQueries().runCalendarTick()).rejects.toMatchObject({
      code: "database_unavailable",
    });
  });

  it("normalizes a rejected transport request", async () => {
    mocks.serviceRpc.mockRejectedValue(new TypeError("fetch failed"));
    await expect(new SupabaseSuperadminCalendarQueries().runCalendarTick()).rejects.toMatchObject({
      code: "database_unavailable",
    });
  });
});
