import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getProvisionedCurrentPlayer: vi.fn(),
  currentViewerReaderFor: vi.fn(),
  profileCommandsFor: vi.fn(),
  mediaAssetCommandsFor: vi.fn(),
  ApplicationProfileUseCases: vi.fn(),
  dependencies: null as unknown,
  useCases: {
    getCurrentViewer: vi.fn(),
    updateName: vi.fn(),
    prepareAvatar: vi.fn(),
    confirmAvatar: vi.fn(),
    abortAvatar: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/application/use-cases/profile", () => ({
  ApplicationProfileUseCases: mocks.ApplicationProfileUseCases,
}));
vi.mock("@/infrastructure/supabase/identity/currentViewer", () => ({
  getProvisionedCurrentPlayer: mocks.getProvisionedCurrentPlayer,
  supabaseCurrentViewerReaderFor: mocks.currentViewerReaderFor,
}));
vi.mock("@/infrastructure/supabase/identity/profileCommands", () => ({
  supabaseProfileCommandsFor: mocks.profileCommandsFor,
}));
vi.mock("@/infrastructure/supabase/assets/mediaAssetCommands", () => ({
  supabaseMediaAssetCommandsFor: mocks.mediaAssetCommandsFor,
}));
vi.mock("@/infrastructure/supabase/assets/mediaStorage", () => ({
  supabaseMediaStorage: { kind: "storage" },
}));

import {
  abortCurrentPlayerAvatar,
  confirmCurrentPlayerAvatar,
  getCurrentViewerProfile,
  prepareCurrentPlayerAvatar,
  updateCurrentPlayerName,
} from "./profile";

describe("server profile composition", () => {
  const current = {
    authUserId: "auth-user",
    row: { player_id: "player-1" },
    supabase: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProvisionedCurrentPlayer.mockResolvedValue(current);
    mocks.currentViewerReaderFor.mockReturnValue({ getCurrentViewer: vi.fn() });
    mocks.profileCommandsFor.mockReturnValue({ updateName: vi.fn() });
    mocks.mediaAssetCommandsFor.mockReturnValue({});
    mocks.ApplicationProfileUseCases.mockImplementation((dependencies) => {
      mocks.dependencies = dependencies;
      return mocks.useCases;
    });
    mocks.useCases.getCurrentViewer.mockResolvedValue(null);
    mocks.useCases.updateName.mockResolvedValue({ ok: true });
    mocks.useCases.prepareAvatar.mockResolvedValue({ ok: true });
    mocks.useCases.confirmAvatar.mockResolvedValue({ ok: true });
    mocks.useCases.abortAvatar.mockResolvedValue(undefined);
  });

  it.each([
    ["get profile", () => getCurrentViewerProfile(), "getCurrentViewer"],
    ["update name", () => updateCurrentPlayerName("Alice"), "updateName"],
    [
      "prepare avatar",
      () =>
        prepareCurrentPlayerAvatar({
          mimeType: "image/png",
          byteSize: 120,
          idempotencyKey: "prepare-key",
        }),
      "prepareAvatar",
    ],
    [
      "confirm avatar",
      () => confirmCurrentPlayerAvatar({ assetId: "asset-1", idempotencyKey: "confirm-key" }),
      "confirmAvatar",
    ],
    ["abort avatar", () => abortCurrentPlayerAvatar("asset-1"), "abortAvatar"],
  ])("provisions the current player once for %s", async (_label, operation, method) => {
    await operation();

    expect(mocks.getProvisionedCurrentPlayer).toHaveBeenCalledOnce();
    expect(mocks.ApplicationProfileUseCases).toHaveBeenCalledOnce();
    expect(mocks.currentViewerReaderFor).toHaveBeenCalledWith(current);
    expect(mocks.profileCommandsFor).toHaveBeenCalledWith(current);
    expect(mocks.mediaAssetCommandsFor).toHaveBeenCalledWith("auth-user");
    expect(mocks.useCases[method as keyof typeof mocks.useCases]).toHaveBeenCalledOnce();
  });

  it("does not construct use cases when there is no authenticated player", async () => {
    mocks.getProvisionedCurrentPlayer.mockResolvedValue(null);

    await expect(updateCurrentPlayerName("Alice")).resolves.toMatchObject({
      ok: false,
      code: "unauthorized",
    });
    expect(mocks.ApplicationProfileUseCases).not.toHaveBeenCalled();
  });
});
