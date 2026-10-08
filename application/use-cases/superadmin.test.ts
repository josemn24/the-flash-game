import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import type { SuperadminPortalContext } from "@/types/view-models";
import {
  ApplicationSuperadminAccess,
  ApplicationSuperadminCommands,
  ApplicationSuperadminReads,
  createCalendarTickApplication,
} from "./superadmin";

const context: SuperadminPortalContext = {
  operator: { playerId: "operator-1", displayName: "Operador" },
  rooms: [],
  source: "supabase",
};

function createAccess(options?: {
  readonly viewerPlayerId?: string | null;
  readonly authUserId?: string | null;
}) {
  return new ApplicationSuperadminAccess({
    currentViewer: {
      getCurrentViewer: vi
        .fn()
        .mockResolvedValue(
          options?.viewerPlayerId === null
            ? null
            : { playerId: options?.viewerPlayerId ?? context.operator.playerId },
        ),
    },
    authenticatedUser: {
      getAuthenticatedUserId: vi.fn().mockResolvedValue(options?.authUserId ?? "auth-1"),
    },
    portalQueries: {
      getContext: vi.fn().mockResolvedValue(context),
    },
    requestIds: { generate: vi.fn().mockReturnValue("request-1") },
  });
}

function createReads(access: ApplicationSuperadminAccess) {
  return new ApplicationSuperadminReads({
    access,
    portal: {
      getContext: vi.fn().mockResolvedValue(context),
      lookupPlayersByEmail: vi.fn().mockResolvedValue([]),
    },
    dashboard: {
      getDashboard: vi.fn().mockResolvedValue({}),
    },
    rooms: {
      getDetail: vi.fn().mockResolvedValue(null),
    },
    editorial: {
      getContext: vi.fn().mockResolvedValue({ entries: [], source: "supabase" }),
      getChallengeCatalog: vi.fn().mockResolvedValue({ entries: [], source: "supabase" }),
      getChallengeDetail: vi.fn().mockResolvedValue(null),
      getChallengeVersionComparison: vi.fn().mockResolvedValue(null),
      getQuestionLibrary: vi.fn().mockResolvedValue({
        entries: [],
        total: 0,
        page: 1,
        pageSize: 50,
        source: "supabase",
      }),
      getQuestionVersion: vi.fn().mockResolvedValue({}),
    },
    calendar: {
      getContext: vi.fn().mockResolvedValue({}),
    },
    attempts: {
      listPublications: vi.fn().mockResolvedValue(null),
      listAttempts: vi.fn().mockResolvedValue(null),
      getInspection: vi.fn().mockResolvedValue(null),
    },
  });
}

function createCommands(access: ApplicationSuperadminAccess) {
  const rateLimiter = { consume: vi.fn() };
  const rooms = { createRoom: vi.fn().mockResolvedValue({}) };
  const attempts = {
    adjust: vi.fn().mockResolvedValue({}),
    invalidate: vi.fn().mockResolvedValue({}),
  };
  const commands = new ApplicationSuperadminCommands({
    access,
    rateLimiter,
    rooms,
    editorial: {} as never,
    editorialQueries: {} as never,
    calendar: {} as never,
    seasons: {} as never,
    users: {} as never,
    authAdmin: {} as never,
    attemptCommandsFor: vi.fn().mockReturnValue(attempts),
  });
  return { commands, rateLimiter, rooms, attempts };
}

describe("application superadmin use cases", () => {
  it("rejects unauthenticated reads and commands", async () => {
    const access = createAccess({ viewerPlayerId: null });
    const reads = createReads(access);
    const { commands } = createCommands(access);

    await expect(reads.getDashboard()).rejects.toBeInstanceOf(AuthenticationRequiredError);
    await expect(
      commands.createRoom({
        idempotencyKey: "room-1",
        title: "Sala",
        description: "Descripción",
        timeZone: "UTC",
        ownerEmail: "owner@example.com",
        initialMembers: [],
        reason: "Prueba",
      }),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("rejects authenticated users without the superadmin assignment", async () => {
    const access = createAccess({ viewerPlayerId: "player-2" });
    const reads = createReads(access);
    const { commands } = createCommands(access);

    await expect(reads.getRooms()).rejects.toBeInstanceOf(SuperadminAccessDeniedError);
    await expect(commands.createSeason({} as never)).rejects.toBeInstanceOf(
      SuperadminAccessDeniedError,
    );
  });

  it("rate limits commands and delegates their original input", async () => {
    const access = createAccess();
    const { commands, rateLimiter, rooms } = createCommands(access);
    const input = {
      idempotencyKey: "room-1",
      title: "Sala",
      description: "Descripción",
      timeZone: "UTC",
      ownerEmail: "owner@example.com",
      initialMembers: [],
      reason: "Prueba",
    };

    await commands.createRoom(input);

    expect(rateLimiter.consume).toHaveBeenCalledWith("superadmin");
    expect(rooms.createRoom).toHaveBeenCalledWith(input);
  });

  it("keeps calendar tick independent from interactive superadmin access", async () => {
    const runner = {
      runCalendarTick: vi.fn().mockResolvedValue({
        runId: "run-1",
        evaluatedAt: "2026-10-08T00:00:00.000Z",
        opened: 1,
        closed: 0,
        finishedSeasons: 0,
        abandonedAttempts: 0,
        source: "supabase" as const,
      }),
    };

    await expect(createCalendarTickApplication(runner).runCalendarTick()).resolves.toMatchObject({
      runId: "run-1",
    });
    expect(runner.runCalendarTick).toHaveBeenCalledOnce();
  });
});
