import { describe, expect, it, vi } from "vitest";
import { SuperadminAccessDeniedError } from "./errors";
import { readCompleteQuestionLibrary } from "./read-complete-question-library";
import type { SuperadminQuestionLibraryEntry } from "@/types/view-models/editorial";
import type { QuestionLibraryFilters } from "@/application/ports/superadmin-editorial-commands";

function entry(index: number): SuperadminQuestionLibraryEntry {
  return {
    questionDefinitionId: `definition-${index}`,
    questionVersionId: `version-${index}`,
    versionNumber: 1,
    status: "published",
    slug: `question-${index}`,
    type: "true-false",
    question: `Question ${index}?`,
    category: "Library",
    tags: {},
    timeLimitMs: 30_000,
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-15T00:00:00Z",
    publishedAt: "2026-10-15T00:00:00Z",
    versionCount: 1,
    usageCount: 0,
  };
}

function page(entries: readonly SuperadminQuestionLibraryEntry[], total: number, number = 1) {
  return { entries, total, page: number, pageSize: 25, source: "supabase" as const };
}

describe("complete editorial question library", () => {
  it("reads every page in order while preserving filters and initial metadata", async () => {
    const entries = Array.from({ length: 127 }, (_, index) => entry(index));
    const getQuestionLibrary = vi.fn(async (filters: QuestionLibraryFilters = {}) => {
      const number = filters.page ?? 1;
      return page(entries.slice((number - 1) * 25, number * 25), 127, number);
    });
    const result = await readCompleteQuestionLibrary(
      { getQuestionLibrary },
      { status: "all", search: "question", type: "true-false", tag: "Library" },
    );
    expect(result).toEqual(page(entries, 127));
    expect(getQuestionLibrary.mock.calls.map(([filters]) => filters?.page)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(getQuestionLibrary).toHaveBeenLastCalledWith({
      status: "all",
      search: "question",
      type: "true-false",
      tag: "Library",
      page: 6,
      pageSize: 25,
    });
    expect(result.entries[126]?.questionVersionId).toBe("version-126");
  });

  it("accepts an empty library without requesting another page", async () => {
    const getQuestionLibrary = vi.fn().mockResolvedValue(page([], 0));
    await expect(readCompleteQuestionLibrary({ getQuestionLibrary })).resolves.toEqual(page([], 0));
    expect(getQuestionLibrary).toHaveBeenCalledOnce();
  });

  it("accepts the unpaginated first response from the previous SQL", async () => {
    const previous = page(
      Array.from({ length: 127 }, (_, index) => entry(index)),
      127,
    );
    const getQuestionLibrary = vi.fn().mockResolvedValue(previous);
    expect(await readCompleteQuestionLibrary({ getQuestionLibrary })).toBe(previous);
    expect(getQuestionLibrary).toHaveBeenCalledOnce();
  });

  it.each([new Error("database unavailable"), new SuperadminAccessDeniedError()])(
    "propagates errors after a successful page without returning partial entries: %s",
    async (error) => {
      const getQuestionLibrary = vi
        .fn()
        .mockResolvedValueOnce(page([entry(1)], 2))
        .mockRejectedValueOnce(error);
      await expect(readCompleteQuestionLibrary({ getQuestionLibrary })).rejects.toBe(error);
    },
  );

  it.each([{ entries: [] }, { entries: [entry(1)] }])(
    "rejects an empty or repeated page before the total: %j",
    async ({ entries }) => {
      const getQuestionLibrary = vi
        .fn()
        .mockResolvedValueOnce(page([entry(1)], 2))
        .mockResolvedValueOnce(page(entries, 2, 2));
      await expect(readCompleteQuestionLibrary({ getQuestionLibrary })).rejects.toThrow(
        "stopped before",
      );
    },
  );

  it("stops at the SQL page limit instead of silently returning an incomplete library", async () => {
    const getQuestionLibrary = vi.fn(async (filters: QuestionLibraryFilters = {}) => {
      const number = filters.page ?? 1;
      return page([entry(number)], 10_001, number);
    });
    await expect(readCompleteQuestionLibrary({ getQuestionLibrary })).rejects.toThrow(
      "exceeded its page limit",
    );
    expect(getQuestionLibrary).toHaveBeenCalledTimes(10_000);
  });
});
