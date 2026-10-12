import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EDITORIAL_FORMAT_PARSERS } from "@/lib/question-formats/editorialRegistry";
import { corpus } from "@/test-utils/format-contracts/context";
import type { FlashEditorialQuestion } from "@/types/contracts/stored-questions";
import { EDITORIAL_PREVIEW_RENDERERS, renderEditorialQuestion } from "./editorialPreviewRegistry";

describe("editorial format previews", () => {
  it("covers the same inline formats as editorial validation", () => {
    expect(Object.keys(EDITORIAL_PREVIEW_RENDERERS).sort()).toEqual(
      Object.keys(EDITORIAL_FORMAT_PARSERS).sort(),
    );
  });

  it.each(corpus.filter((test) => test.valid && test.inline))(
    "renders $id without creating a game session",
    (test) => {
      const question = EDITORIAL_FORMAT_PARSERS[
        test.document.type as FlashEditorialQuestion["type"]
      ]({ ...test.document, points: 50 });
      const before = structuredClone(question);
      const markup = renderToStaticMarkup(<>{renderEditorialQuestion(question, 0)}</>);
      expect(markup).toContain("Pregunta 01");
      expect(markup).toContain("50 puntos");
      expect(markup).not.toContain("start_attempt");
      expect(question).toEqual(before);
    },
  );

  it("renders immutable library references without resolving private solutions", () => {
    const markup = renderToStaticMarkup(
      <>
        {renderEditorialQuestion(
          { source: "library", questionVersionId: "published-version", points: 25, modeConfig: {} },
          2,
        )}
      </>,
    );
    expect(markup).toContain("Pregunta 03");
    expect(markup).toContain("published-version");
    expect(markup).toContain("25 puntos · biblioteca");
    expect(markup).not.toContain("Solución privada:");
  });
});
