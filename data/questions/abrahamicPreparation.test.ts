import { describe, expect, it } from "vitest";
import { questionsById } from "@/data/questions";
import {
  buildWordHashtagSolution,
  calculateMinimumWordHashtagSwaps,
  isValidWordHashtagConfiguration,
  replayWordHashtagSwaps,
} from "@/lib/wordHashtag";
import { isValidWordSearchConfiguration } from "@/lib/wordSearch";
import type { WordHashtagQuestion, WordSearchQuestion } from "@/types/game";

const wordSearch = questionsById["abrahamic-word-search-biblical-characters"] as WordSearchQuestion;
const wordHashtag = questionsById["abrahamic-word-hashtag-references"] as WordHashtagQuestion;

describe("Abrahamic challenge preparation", () => {
  it("ships a unique 8 × 8 word search with six biblical characters", () => {
    expect(wordSearch.letters).toHaveLength(64);
    expect(wordSearch.targets).toHaveLength(6);
    expect(wordSearch.targets.map((target) => target.word)).toContain("JESUS");
    expect(wordSearch.targets.map((target) => target.word)).not.toContain("DANIEL");
    expect(isValidWordSearchConfiguration(wordSearch)).toBe(true);
  });

  it("ships a six-swap Hashtag board that remains solvable within seven moves", () => {
    const solution = buildWordHashtagSolution(wordHashtag.words)!;
    expect(isValidWordHashtagConfiguration(wordHashtag)).toBe(true);
    expect(calculateMinimumWordHashtagSwaps(wordHashtag.initialLetters, solution)).toBe(6);
    expect(
      replayWordHashtagSwaps(wordHashtag, [
        { fromCell: 5, toCell: 7 },
        { fromCell: 7, toCell: 8 },
        { fromCell: 8, toCell: 9 },
        { fromCell: 9, toCell: 13 },
        { fromCell: 11, toCell: 17 },
        { fromCell: 13, toCell: 19 },
      ]),
    ).toMatchObject({ valid: true, appliedMoves: 6, solved: true });
  });
});
