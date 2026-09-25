import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { SupabaseSuperadminSeasonCommands } from "./superadminSeasonQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const result = {
  seasonId: "00000000-0000-4000-8000-000000000001",
  roomId: "00000000-0000-4000-8000-000000000002",
  title: "Temporada beta",
  status: "draft" as const,
  startsAt: "2026-09-20T10:30:00.000Z",
  endsAt: "2026-09-27T10:30:00.000Z",
};

describe("SupabaseSuperadminSeasonCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("calls the narrow create RPC and validates its result", async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null });

    await expect(
      new SupabaseSuperadminSeasonCommands().createSeason({
        idempotencyKey: "season-create-1",
        roomId: result.roomId,
        title: result.title,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        reason: "Beta",
      }),
    ).resolves.toEqual({ ...result, source: "supabase" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_superadmin_season", {
      input: expect.objectContaining({ roomId: result.roomId }),
    });
  });

  it("uses the exact update and activation RPC names", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...result, status: "active" }, error: null });
    const commands = new SupabaseSuperadminSeasonCommands();

    await commands.updateSeason({
      idempotencyKey: "season-update-1",
      seasonId: result.seasonId,
      title: result.title,
      startsAt: result.startsAt,
      endsAt: result.endsAt,
      reason: "Update",
    });
    await commands.activateSeason({
      idempotencyKey: "season-activate-1",
      seasonId: result.seasonId,
      reason: "Activate",
    });

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "update_superadmin_season", {
      input: expect.any(Object),
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "activate_superadmin_season", {
      input: expect.any(Object),
    });
  });

  it("maps authorization and domain errors without falling back", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not_authorized" },
    });
    await expect(
      new SupabaseSuperadminSeasonCommands().activateSeason({
        idempotencyKey: "season-auth-1",
        seasonId: result.seasonId,
        reason: "Activate",
      }),
    ).rejects.toBeInstanceOf(SuperadminAccessDeniedError);

    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "55000", message: "season_not_draft" },
    });
    await expect(
      new SupabaseSuperadminSeasonCommands().updateSeason({
        idempotencyKey: "season-domain-1",
        seasonId: result.seasonId,
        title: result.title,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        reason: "Update",
      }),
    ).rejects.toMatchObject({
      code: "season_not_draft",
      name: "SuperadminSeasonCommandError",
    });
  });

  it("rejects an invalid response instead of inventing a season", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...result, seasonId: "invalid" }, error: null });

    await expect(
      new SupabaseSuperadminSeasonCommands().createSeason({
        idempotencyKey: "season-invalid-1",
        roomId: result.roomId,
        title: result.title,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        reason: "Beta",
      }),
    ).rejects.toMatchObject({
      code: "invalid_response",
      name: "SuperadminSeasonCommandError",
    });
  });
});
