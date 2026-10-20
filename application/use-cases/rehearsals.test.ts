import { describe, expect, it, vi } from "vitest";
import { Rehearsals } from "./rehearsals";
import { listRehearsals } from "@/infrastructure/rehearsals/catalog";
import type { RehearsalStore } from "@/application/ports/rehearsals";

function setup() {
  const artifact = listRehearsals()[0]!;
  const store: RehearsalStore = {
    readPlayer: vi.fn().mockResolvedValue({ ref: artifact.ref, source: artifact.source }),
    readEditorial: vi.fn().mockResolvedValue({
      challengeVersionId: "version",
      updatedAt: "now",
      sourceHash: "source-hash",
      status: "draft",
      ref: null,
      source: artifact.source,
    }),
    associate: vi.fn(),
  };
  const catalog = { list: () => listRehearsals(), resolve: vi.fn().mockReturnValue(artifact) };
  return { artifact, store, catalog, service: new Rehearsals(store, catalog) };
}
describe("authorized rehearsal use cases", () => {
  it("returns only practice content, never its competitive source", async () => {
    const { service, artifact, store } = setup();
    expect(await service.getPlayerRehearsal("room", "publication")).toEqual({
      ref: artifact.ref,
      definition: artifact.definition,
    });
    expect(store.associate).not.toHaveBeenCalled();
  });
  it("never resolves catalog content when access is denied", async () => {
    const { service, store, catalog } = setup();
    vi.mocked(store.readPlayer).mockResolvedValue(null);
    expect(await service.getPlayerRehearsal("room", "publication")).toBeNull();
    expect(catalog.resolve).not.toHaveBeenCalled();
  });
  it("rejects references missing from the deployed version", async () => {
    const { service, catalog } = setup();
    catalog.resolve.mockReturnValue(null);
    await expect(service.getPlayerRehearsal("room", "publication")).rejects.toThrow(
      "rehearsal_catalog_missing",
    );
  });
  it("rejects a source that no longer matches", async () => {
    const { service, store, artifact } = setup();
    vi.mocked(store.readPlayer).mockResolvedValue({
      ref: artifact.ref,
      source: { ...artifact.source, globalTimeLimitMs: 1 },
    });
    await expect(service.getPlayerRehearsal("room", "publication")).rejects.toThrow(
      "rehearsal_incompatible",
    );
  });
  it("editorial choices expose mechanics issues without official payloads or answers", async () => {
    const { service } = setup();
    const result = await service.getEditorial("version");
    expect(result?.choices.some((c) => c.issues.length === 0)).toBe(true);
    expect(result?.choices.some((c) => c.issues.length > 0)).toBe(true);
    expect(result).not.toHaveProperty("source");
    expect(result).not.toHaveProperty("sourceHash");
  });
  it("validates repository content before invoking the guarded mutation", async () => {
    const { service, artifact, store } = setup();
    const input = {
      challengeVersionId: "version",
      expectedUpdatedAt: "now",
      idempotencyKey: "command-key",
      reason: "Preparación",
      ref: artifact.ref,
    };
    await service.associate(input);
    expect(store.associate).toHaveBeenCalledWith({ ...input, sourceHash: "source-hash" });
  });
  it("cannot persist an invented artifact", async () => {
    const { service, store, catalog, artifact } = setup();
    catalog.resolve.mockReturnValue(null);
    await expect(
      service.associate({
        challengeVersionId: "version",
        expectedUpdatedAt: "now",
        idempotencyKey: "command-key",
        reason: "Preparación",
        ref: artifact.ref,
      }),
    ).rejects.toThrow("rehearsal_incompatible");
    expect(store.associate).not.toHaveBeenCalled();
  });
  it("allows removing a draft association without selecting another exercise", async () => {
    const { service, store } = setup();
    await service.associate({
      challengeVersionId: "version",
      expectedUpdatedAt: "now",
      idempotencyKey: "command-key",
      reason: "Retirada",
      ref: null,
    });
    expect(store.associate).toHaveBeenCalledWith(expect.objectContaining({ ref: null }));
  });
});
