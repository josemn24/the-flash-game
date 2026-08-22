import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { questionsById } from "@/data/questions";
import { WordSearchQuestion } from "@/components/WordSearchQuestion";

describe("Word-search target list", () => {
  it("hides target words visually during the game", () => {
    const question = questionsById["abrahamic-word-search-biblical-characters"];
    const markup = renderToStaticMarkup(
      <WordSearchQuestion
        question={question}
        locked={false}
        onProgress={vi.fn()}
        onIncorrectAttempt={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain('class="sr-only" aria-label="Palabras objetivo"');
    expect(markup).not.toContain("WordSearchQuestion_wordList");
  });
});
