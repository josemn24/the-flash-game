import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StartCountdown } from "./StartCountdown.client";

const countdownSource = readFileSync(
  new URL("./StartCountdown.client.tsx", import.meta.url),
  "utf8",
);
const flashSource = readFileSync(
  new URL("../modes/flash-pop/FlashPopFlashGame.client.tsx", import.meta.url),
  "utf8",
);
const survivalSource = readFileSync(
  new URL("../modes/flash-pop/FlashPopSurvivalGame.client.tsx", import.meta.url),
  "utf8",
);
const alphabetSource = readFileSync(
  new URL("../modes/flash-pop/FlashPopAlphabetGame.client.tsx", import.meta.url),
  "utf8",
);

describe("StartCountdown", () => {
  it("renders the shared accessible countdown shell", () => {
    const markup = renderToStaticMarkup(
      <StartCountdown label="Supervivencia" onComplete={() => {}} />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain("Supervivencia");
    expect(markup).toContain("Prepárate");
    expect(markup).toContain(">3</strong>");
    expect(markup).toContain("El tiempo empieza después de la cuenta atrás");
  });

  it("keeps the 3–2–1 cadence and completes after the final number", () => {
    expect(countdownSource).toContain("const [count, setCount] = useState(3);");
    expect(countdownSource).toContain("}, 1000);");
    expect(countdownSource).toContain("if (count === 1) onComplete();");
    expect(countdownSource).toContain("else setCount((value) => value - 1);");
  });

  it("is wired into all three active timed modes", () => {
    expect(alphabetSource).toContain("onStart={session.beginCountdown}");
    expect(alphabetSource).toContain('label="Alfabeto"');
    expect(flashSource).toContain("onStart={session.beginCountdown}");
    expect(flashSource).toContain('label="Flash clásico"');
    expect(survivalSource).toContain("onStart={session.beginCountdown}");
    expect(survivalSource).toContain('label="Supervivencia"');
  });
});
