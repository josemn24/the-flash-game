import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopHome } from "@/components/game/modes/flash-pop/FlashPopHome.client";
import type { ChallengeSummary } from "@/types/game";

const challenges: ChallengeSummary[] = [
  {
    id: "tabarnia-flash-01",
    number: 1,
    title: "Flash clásico",
    subtitle: "Dieciséis retos para entrar en ritmo.",
    mode: "flash",
    questionCount: 16,
    availableFrom: "2026-08-29T22:00:00.000Z",
    availableUntil: "2026-08-31T21:59:59.999Z",
    availabilityStatus: "expired",
    playable: false,
    openable: true,
    implementationStatus: "prototype",
  },
  {
    id: "tabarnia-challenge-07",
    number: 7,
    title: "Próximo reto",
    subtitle: "Próximamente",
    mode: "flash",
    questionCount: 0,
    availableFrom: "2026-08-14T22:00:00.000Z",
    availableUntil: "2026-08-15T21:59:59.999Z",
    availabilityStatus: "expired",
    playable: false,
  },
];

describe("FlashPopHome", () => {
  it("exposes the Flash pilot from the real lobby data", () => {
    const markup = renderToStaticMarkup(
      <FlashPopHome
        roomTitle="Tabarnia"
        seasonTitle="Primera temporada"
        seasonStatus="active"
        challenges={challenges}
      />,
    );

    expect(markup).toContain("Elige tu próximo reto.");
    expect(markup).toContain('href="/desafios/tabarnia-flash-01"');
    expect(markup).toContain("Jugar ahora");
    expect(markup).toContain("1/2 retos accesibles");
  });
});
