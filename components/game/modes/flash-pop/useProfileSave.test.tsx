// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileSave } from "./useProfileSave";
import {
  abortProfileAvatar,
  confirmProfileAvatar,
  prepareProfileAvatar,
  updateProfileName,
} from "@/app/actions/profile";
import { uploadFile } from "@/lib/media/uploadFile";

vi.mock("@/app/actions/profile", () => ({
  abortProfileAvatar: vi.fn(),
  confirmProfileAvatar: vi.fn(),
  prepareProfileAvatar: vi.fn(),
  updateProfileName: vi.fn(),
}));
vi.mock("@/lib/media/uploadFile", () => ({ uploadFile: vi.fn() }));
const profile = { id: "player", name: "Ana", avatarSrc: "/old.png" };
const saved = { ...profile, avatarSrc: "/saved.png", playerId: "player" as never };
const input = { name: "Ana", file: new File(["bytes"], "avatar.png", { type: "image/png" }) };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(updateProfileName).mockResolvedValue({ ok: true, profile });
  vi.mocked(prepareProfileAvatar).mockResolvedValue({
    ok: true,
    assetId: "asset",
    objectPath: "avatars/player/asset.png",
    signedUploadUrl: "https://upload.test",
    uploadToken: "opaque",
    expiresAt: "2026-10-06",
    confirmIdempotencyKey: "original-key",
  });
  vi.mocked(uploadFile).mockResolvedValue(true);
  vi.mocked(confirmProfileAvatar).mockResolvedValue({ ok: true, profile: saved });
});
afterEach(cleanup);
function setup() {
  const named = vi.fn(),
    confirmed = vi.fn();
  const hook = renderHook(({ id }) => useProfileSave(id, named, confirmed), {
    initialProps: { id: "player" },
  });
  return { ...hook, named, confirmed };
}

describe("profile confirmation in memory", () => {
  it("retries the original command after a lost response without another upload or name update", async () => {
    vi.mocked(confirmProfileAvatar).mockRejectedValueOnce(new Error("response lost"));
    const { result, named, confirmed, rerender } = setup();
    await act(async () => {
      expect(await result.current.save(input)).toMatchObject({ code: "confirmation_pending" });
    });
    expect(result.current.confirmationPending).toBe(true);
    expect(named).toHaveBeenCalledWith(profile);
    expect(confirmed).not.toHaveBeenCalled();
    // Closing/reopening does not unmount the home. File selection may be gone.
    rerender({ id: "player" });
    await act(async () => {
      expect(await result.current.save({ name: "Ignored draft", file: null })).toMatchObject({
        ok: true,
      });
    });
    expect(confirmProfileAvatar).toHaveBeenNthCalledWith(1, {
      assetId: "asset",
      idempotencyKey: "original-key",
    });
    expect(confirmProfileAvatar).toHaveBeenNthCalledWith(2, {
      assetId: "asset",
      idempotencyKey: "original-key",
    });
    expect(updateProfileName).toHaveBeenCalledTimes(1);
    expect(prepareProfileAvatar).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(abortProfileAvatar).not.toHaveBeenCalled();
    expect(confirmed).toHaveBeenCalledWith(saved);
    expect(result.current.confirmationPending).toBe(false);
  });

  it("retains the same command when the server reports uncertainty", async () => {
    vi.mocked(confirmProfileAvatar).mockResolvedValueOnce({
      ok: false,
      code: "confirmation_pending",
      message: "No hemos podido confirmar la imagen",
    });
    const { result } = setup();
    await act(async () => {
      await result.current.save(input);
    });
    expect(result.current.confirmationPending).toBe(true);
    await act(async () => {
      await result.current.save(input);
    });
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it.each(["conflict", "unauthorized", "invalid_file", "save_failed"] as const)(
    "stops pending confirmation after %s",
    async (code) => {
      vi.mocked(confirmProfileAvatar).mockResolvedValue({
        ok: false,
        code,
        message: "Unavailable",
      });
      const { result } = setup();
      await act(async () => {
        await result.current.save(input);
      });
      expect(result.current.confirmationPending).toBe(false);
      expect(abortProfileAvatar).not.toHaveBeenCalled();
    },
  );

  it("blocks a second save while the first confirmation is outstanding", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof confirmProfileAvatar>>) => void;
    vi.mocked(confirmProfileAvatar).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = setup();
    let first!: Promise<unknown>;
    await act(async () => {
      first = result.current.save(input);
    });
    expect(result.current.isSaving).toBe(true);
    await act(async () => {
      await result.current.save(input);
    });
    expect(uploadFile).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ ok: true, profile: saved });
      await first;
    });
  });

  it("discards late confirmations after changing account", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof confirmProfileAvatar>>) => void;
    vi.mocked(confirmProfileAvatar).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result, rerender, confirmed } = setup();
    let first!: Promise<unknown>;
    await act(async () => {
      first = result.current.save(input);
    });
    rerender({ id: "other-account" });
    await act(async () => {
      resolve({ ok: true, profile: saved });
      await first;
    });
    expect(confirmed).not.toHaveBeenCalled();
    expect(result.current.confirmationPending).toBe(false);
    await act(async () => {
      await result.current.save({ name: "Other", file: null });
    });
    expect(updateProfileName).toHaveBeenLastCalledWith("Other");
    expect(confirmProfileAvatar).toHaveBeenCalledTimes(1);
  });

  it("does not apply results after unmount", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof confirmProfileAvatar>>) => void;
    vi.mocked(confirmProfileAvatar).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result, unmount, confirmed } = setup();
    let first!: Promise<unknown>;
    await act(async () => {
      first = result.current.save(input);
    });
    unmount();
    await act(async () => {
      resolve({ ok: true, profile: saved });
      await first;
    });
    expect(confirmed).not.toHaveBeenCalled();
    expect(abortProfileAvatar).not.toHaveBeenCalled();
  });

  it("cancels an unconfirmed failed upload but preserves the saved name", async () => {
    vi.mocked(uploadFile).mockResolvedValue(false);
    vi.mocked(abortProfileAvatar).mockResolvedValue(undefined);
    const { result, named, confirmed } = setup();
    await act(async () => {
      expect(await result.current.save(input)).toMatchObject({ code: "storage_unavailable" });
    });
    expect(named).toHaveBeenCalledWith(profile);
    expect(confirmed).not.toHaveBeenCalled();
    expect(abortProfileAvatar).toHaveBeenCalledWith("asset");
    expect(confirmProfileAvatar).not.toHaveBeenCalled();
  });
});
