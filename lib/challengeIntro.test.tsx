import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { challenges } from "@/data/challenges";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { buildChallengeIntroModel } from "@/lib/challengeIntro";

describe("challenge intro model", () => {
  it("builds the same three-metric contract for every challenge mode", () => {
    const modes = new Set<string>();

    challenges.forEach((challenge) => {
      const model = buildChallengeIntroModel(challenge);
      modes.add(challenge.mode);

      expect(model.metrics).toHaveLength(3);
      expect(model.title).toBe(challenge.title);
      expect(model.rules).toHaveLength(3);
    });

    expect([...modes].sort()).toEqual(["alphabet", "flash", "narrative", "pyramid", "survival"]);
  });

  it("keeps the mode-specific essential metrics", () => {
    const expectedLabels = {
      flash: ["Preguntas", "Tiempo estimado", "Formatos"],
      survival: ["Retos", "Vidas", "Tiempo estimado"],
      alphabet: ["Letras", "Tiempo estimado", "Puntos"],
      narrative: ["Pruebas", "Puntos", "Tiempo estimado"],
      pyramid: ["Niveles", "Tiempo estimado", "Puntos"],
    } as const;

    challenges.forEach((challenge) => {
      expect(buildChallengeIntroModel(challenge).metrics.map((metric) => metric.label)).toEqual(
        expectedLabels[challenge.mode],
      );
    });
  });

  it("formats estimated times as whole minutes", () => {
    const alphabet = challenges.find((challenge) => challenge.mode === "alphabet");
    const pyramid = challenges.find((challenge) => challenge.mode === "pyramid");

    expect(alphabet).toBeDefined();
    expect(pyramid).toBeDefined();
    expect(buildChallengeIntroModel(alphabet!).metrics[1].value).toBe("2 min");
    expect(buildChallengeIntroModel(pyramid!).metrics[1].value).toBe("3 min");
    expect(
      buildChallengeIntroModel(challenges.find((challenge) => challenge.mode === "narrative")!)
        .metrics[2].value,
    ).toBe("≈ 10 min");
  });
});

describe("ChallengeIntro", () => {
  it("renders the shared structure without mode-specific previews", () => {
    challenges.forEach((challenge) => {
      const markup = renderToStaticMarkup(
        <ChallengeIntro challenge={challenge} onStart={() => undefined} />,
      );

      expect(markup).toContain("Resumen del desafío");
      expect(markup).toContain("Reglas principales");
      expect(markup).toContain("Empezar desafío");
      expect(markup).toContain('aria-label="Volver a desafíos"');
      expect(markup).not.toContain("Volver a desafíos</a>");
      expect(markup).not.toContain("ALFABETO");
      expect(markup).not.toContain("Estado de las letras");
      expect(markup).not.toContain("introIllustration");
    });
  });

  it("returns to the room when the challenge belongs to one", () => {
    const challenge = challenges[0];
    const markup = renderToStaticMarkup(
      <ChallengeIntro
        challenge={challenge}
        onStart={() => undefined}
        returnTo="/salas/tabarnia-room"
      />,
    );

    expect(markup).toContain('href="/salas/tabarnia-room"');
  });
});
