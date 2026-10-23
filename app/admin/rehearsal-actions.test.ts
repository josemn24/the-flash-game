import { beforeEach, expect, it, vi } from "vitest";
import { updateRehearsalPolicy, previewRehearsal } from "./rehearsal-actions";
import { requireSuperadmin } from "@/server/admin";
import { saveRehearsalPolicy } from "@/server/production-rehearsal-data-access";
vi.mock("@/server/admin", () => ({ requireSuperadmin: vi.fn() }));
vi.mock("@/server/production-rehearsal-data-access", () => ({
  saveRehearsalPolicy: vi.fn(),
  getRehearsalPreview: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("authorizes policy changes and preserves concurrency and idempotency inputs", async () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    publicationId: "publication",
    enabled: "false",
    expectedUpdatedAt: "",
    idempotencyKey: "command-key",
    reason: "Retirada temporal",
  }))
    f.set(k, v);
  expect(await updateRehearsalPolicy({}, f)).toHaveProperty("message");
  expect(requireSuperadmin).toHaveBeenCalled();
  expect(saveRehearsalPolicy).toHaveBeenCalledWith({
    publicationId: "publication",
    enabled: false,
    expectedUpdatedAt: null,
    idempotencyKey: "command-key",
    reason: "Retirada temporal",
  });
});
it("rejects invalid form values without mutation", async () => {
  expect(await updateRehearsalPolicy({}, new FormData())).toHaveProperty("error");
  expect(saveRehearsalPolicy).not.toHaveBeenCalled();
});
it("checks superadmin before previewing a recipe", async () => {
  vi.mocked(requireSuperadmin).mockRejectedValueOnce(new Error("forbidden"));
  await expect(previewRehearsal("version", {})).rejects.toThrow("forbidden");
});
