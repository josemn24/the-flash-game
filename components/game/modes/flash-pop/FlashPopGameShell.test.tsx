import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlashPopGameShell } from "./FlashPopGameShell";

describe("FlashPopGameShell", () => {
  it("provides the same Canvas contract for the game layout", () => {
    const markup = renderToStaticMarkup(
      <FlashPopGameShell layout="game">
        <section>Pregunta</section>
      </FlashPopGameShell>,
    );

    expect(markup).toContain('data-gameplay-shell="flash-pop"');
    expect(markup).toContain('data-gameplay-layout="game"');
    expect(markup).toContain("Pregunta");
  });

  it("uses an explicit intro layout", () => {
    const markup = renderToStaticMarkup(
      <FlashPopGameShell layout="intro">
        <section>Introducción</section>
      </FlashPopGameShell>,
    );

    expect(markup).toContain('data-gameplay-layout="intro"');
    expect(markup).toContain("Introducción");
  });

  it("applies the mock canvas rhythm only to the pyramid presentation", () => {
    const pyramidMarkup = renderToStaticMarkup(
      <FlashPopGameShell layout="game" presentation="pyramid">
        <section>La Pirámide</section>
      </FlashPopGameShell>,
    );
    const defaultMarkup = renderToStaticMarkup(
      <FlashPopGameShell layout="game">
        <section>Flash</section>
      </FlashPopGameShell>,
    );

    expect(pyramidMarkup).toContain("pyramidScreen");
    expect(defaultMarkup).not.toContain("pyramidScreen");
  });
});
