import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFile } from "./uploadFile";

afterEach(() => vi.unstubAllGlobals());

describe("signed file upload", () => {
  const url = "https://upload.example.com/signed/asset?signature=opaque";
  const file = new File(["image bytes"], "avatar.png", { type: "image/png" });

  it("uploads bytes to the provided URL without credentials or provider headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadFile(url, file)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(url, {
      method: "PUT",
      headers: { "Content-Type": "image/png", "Cache-Control": "max-age=3600" },
      body: file,
    });
  });

  it("reports failed HTTP uploads so the pending asset can be aborted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(uploadFile(url, file)).resolves.toBe(false);
  });

  it("contains network failures so the pending asset can be aborted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(uploadFile(url, file)).resolves.toBe(false);
  });
});
