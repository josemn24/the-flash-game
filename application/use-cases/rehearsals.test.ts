import { expect, it, vi } from "vitest";
import { Rehearsals } from "./rehearsals";
import { rehearsalBank } from "@/infrastructure/rehearsals/bank";
import { rehearsalTemplates } from "@/test-utils/rehearsals/fixtures";
import type { RehearsalStore } from "@/application/ports/rehearsals";
import { activeQuestions } from "@/lib/rehearsals/catalog";
function setup() {
  const template = rehearsalTemplates[0]!;
  const store: RehearsalStore = {
    readPlayer: vi.fn().mockResolvedValue({ template, enabled: true }),
    readEditorial: vi.fn().mockResolvedValue({ template, status: "published", publications: [] }),
    setPolicy: vi.fn(),
  };
  const seed = vi.fn().mockReturnValue("seed");
  return { store, seed, service: new Rehearsals(store, rehearsalBank(), seed) };
}
it("checks coverage without generating or consuming randomness", async () => {
  const { service, seed } = setup();
  expect(await service.getAvailability("room", "publication")).toBe(true);
  expect(seed).not.toHaveBeenCalled();
});
it("does not offer a session when individually compatible slots share too few distinct exercises", async () => {
  const { store, seed } = setup();
  const template = rehearsalTemplates.find((t) => t.mode === "time-trial")!;
  vi.mocked(store.readPlayer).mockResolvedValue({ template, enabled: true });
  const pool = activeQuestions(rehearsalBank())
    .filter((q) => q.type === template.questions[0]!.type)
    .slice(0, 2);
  const service = new Rehearsals(store, pool, seed);
  expect(await service.getAvailability("room", "publication")).toBe(false);
  expect(await service.getPlayerRehearsal("room", "publication")).toEqual({
    status: "unavailable",
  });
  expect(seed).not.toHaveBeenCalled();
});
it("denies access before touching the generator", async () => {
  const { service, store, seed } = setup();
  vi.mocked(store.readPlayer).mockResolvedValue(null);
  expect(await service.getPlayerRehearsal("room", "publication")).toBeNull();
  expect(seed).not.toHaveBeenCalled();
});
it("distinguishes disabled from unauthorized and avoids generating", async () => {
  const { service, store, seed } = setup();
  vi.mocked(store.readPlayer).mockResolvedValue({
    template: rehearsalTemplates[0]!,
    enabled: false,
  });
  expect(await service.getPlayerRehearsal("r", "p")).toEqual({ status: "unavailable" });
  expect(seed).not.toHaveBeenCalled();
});
it("returns only the selected alternative content", async () => {
  const { service } = setup();
  const result = await service.getPlayerRehearsal("r", "p");
  expect(result?.status).toBe("ready");
  expect(result).not.toHaveProperty("template");
  expect(result).not.toHaveProperty("bank");
  const editorial = await service.getEditorial("v");
  expect(editorial).not.toHaveProperty("template");
});
it("previews and replays behind the editorial store authorization", async () => {
  const { service, store } = setup();
  const run = await service.preview("v");
  expect(await service.preview("v", { recipe: run!.recipe })).toEqual(run);
  vi.mocked(store.readEditorial).mockResolvedValue(null);
  expect(await service.preview("v")).toBeNull();
});
