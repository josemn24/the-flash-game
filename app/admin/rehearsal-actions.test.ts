import { beforeEach, expect, it, vi } from "vitest";
import { associateRehearsal } from "./rehearsal-actions";
import { requireSuperadmin } from "@/server/admin";
import {
  getEditorialRehearsal,
  saveRehearsalAssociation,
} from "@/server/production-rehearsal-data-access";
import { revalidatePath } from "next/cache";
vi.mock("@/server/admin", () => ({ requireSuperadmin: vi.fn() }));
vi.mock("@/server/production-rehearsal-data-access", () => ({
  getEditorialRehearsal: vi.fn(),
  saveRehearsalAssociation: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const ref = { id: "deployed", version: 1, contentHash: "a".repeat(64) };
function form(selection = "deployed@1") {
  const value = new FormData();
  for (const [key, text] of Object.entries({
    challengeVersionId: "version",
    expectedUpdatedAt: "stamp",
    idempotencyKey: "command-unique",
    reason: "Preparación",
    rehearsal: selection,
  }))
    value.set(key, text);
  return value;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getEditorialRehearsal).mockResolvedValue({
    challengeVersionId: "version",
    updatedAt: "stamp",
    status: "draft",
    ref: null,
    choices: [{ ref, title: "Ensayo", issues: [] }],
  });
});
it("requires superadmin before resolving or mutating a selection", async () => {
  vi.mocked(requireSuperadmin).mockRejectedValue(new Error("denied"));
  await expect(associateRehearsal({}, form())).rejects.toThrow("denied");
  expect(getEditorialRehearsal).not.toHaveBeenCalled();
  expect(saveRehearsalAssociation).not.toHaveBeenCalled();
});
it("rejects invented references and incompatible deployed choices", async () => {
  expect((await associateRehearsal({}, form("invented@1"))).error).toContain("no existe");
  vi.mocked(getEditorialRehearsal).mockResolvedValue({
    challengeVersionId: "version",
    updatedAt: "stamp",
    status: "draft",
    ref: null,
    choices: [{ ref, title: "Ensayo", issues: ["Modo diferente"] }],
  });
  expect((await associateRehearsal({}, form())).error).toContain("no es compatible");
  expect(saveRehearsalAssociation).not.toHaveBeenCalled();
});
it("passes only a resolved reference and concurrency stamp to the guarded command", async () => {
  expect(await associateRehearsal({}, form())).toEqual({ message: "Ensayo asociado." });
  expect(saveRehearsalAssociation).toHaveBeenCalledWith({
    challengeVersionId: "version",
    expectedUpdatedAt: "stamp",
    idempotencyKey: "command-unique",
    reason: "Preparación",
    ref,
  });
  expect(revalidatePath).toHaveBeenCalledWith("/desafios/[challengeId]", "page");
});
it("permits an explicit removal without making rehearsal mandatory", async () => {
  expect(await associateRehearsal({}, form(""))).toEqual({ message: "Asociación retirada." });
  expect(saveRehearsalAssociation).toHaveBeenCalledWith(expect.objectContaining({ ref: null }));
});
it.each([
  ["content_conflict", "El contenido cambió"],
  ["rehearsal_binding_frozen", "es inmutable"],
])("reports %s without claiming a successful save", async (code, message) => {
  vi.mocked(saveRehearsalAssociation).mockRejectedValue(new Error(code));
  expect((await associateRehearsal({}, form())).error).toContain(message);
  expect(revalidatePath).not.toHaveBeenCalled();
});
