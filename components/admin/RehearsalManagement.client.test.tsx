// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RehearsalManagement, RehearsalPreviewClient } from "./RehearsalManagement.client";
import { previewRehearsal } from "@/app/admin/rehearsal-actions";
import type { GeneratedRehearsal } from "@/types/gameplay/rehearsal";
import type { RehearsalTemplate } from "@/types/gameplay/rehearsal";
import { rehearsalBank } from "@/infrastructure/rehearsals/bank";
import { replayRehearsal } from "@/lib/rehearsals/generator";
import frozen from "@/test-utils/rehearsals/v1-recipes.json";

vi.mock("@/app/admin/rehearsal-actions", () => ({
  previewRehearsal: vi.fn(),
  updateRehearsalPolicy: vi.fn(),
}));
vi.mock("@/components/game/shells/RehearsalGameApp.client", () => ({
  RehearsalGameApp: () => <div>Partida preparada</div>,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const reference: { template: RehearsalTemplate; recipe: GeneratedRehearsal["recipe"] } = JSON.parse(
  JSON.stringify(frozen[0]),
);
const baseline = replayRehearsal(rehearsalBank(), reference.template, reference.recipe);
const run: GeneratedRehearsal = {
  ...baseline,
  difficultyFallbacks: [{ position: 2, requested: "medium", selected: "easy" }],
};

it("shows the full-assignment difficulty warning in editorial coverage", () => {
  render(
    <RehearsalManagement
      versions={[
        {
          challengeVersionId: "version",
          versionNumber: 1,
          status: "published",
          publications: [],
          coverage: {
            ready: true,
            exactDifficultyReady: false,
            warnings: ["La combinación requiere sustituir alguna dificultad por una próxima"],
            slots: [],
          },
        },
      ]}
    />,
  );
  expect(screen.getByText("Cobertura disponible")).toBeDefined();
  expect(screen.getByText(/La combinación requiere sustituir/)).toBeDefined();
});
it("shows the actual fallback and refreshes diagnostics after generating", async () => {
  render(<RehearsalPreviewClient versionId="version" initial={run} />);
  expect(screen.getByRole("region", { name: "Ajustes de dificultad" }).textContent).toContain(
    "Posición 2: solicitada Media, seleccionada Fácil",
  );
  vi.mocked(previewRehearsal).mockResolvedValueOnce({ run: { ...run, difficultyFallbacks: [] } });
  fireEvent.click(screen.getByRole("button", { name: "Generar combinación" }));
  await waitFor(() =>
    expect(screen.queryByRole("region", { name: "Ajustes de dificultad" })).toBeNull(),
  );
  expect(screen.getByText("Partida preparada")).toBeDefined();
});
