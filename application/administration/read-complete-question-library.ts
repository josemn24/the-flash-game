import type {
  QuestionLibraryFilters,
  SuperadminEditorialQueries,
} from "@/application/ports/superadmin-editorial-commands";
import type { SuperadminQuestionLibraryContext } from "@/types/view-models/editorial";

// The portal filters the complete collection locally. Keep individual RPC reads paginated.
export async function readCompleteQuestionLibrary(
  queries: Pick<SuperadminEditorialQueries, "getQuestionLibrary">,
  filters: Omit<QuestionLibraryFilters, "page" | "pageSize"> = {},
): Promise<SuperadminQuestionLibraryContext> {
  const first = await queries.getQuestionLibrary({ ...filters, page: 1, pageSize: 25 });
  const entries = [...first.entries];
  const seen = new Set(entries.map((entry) => entry.questionVersionId));
  // Also accepts the complete first response returned before the SQL pagination fix.
  if (entries.length >= first.total) return first;

  for (let page = 2; page <= 10_000; page++) {
    const next = await queries.getQuestionLibrary({ ...filters, page, pageSize: 25 });
    if (!next.entries.length || next.entries.some((entry) => seen.has(entry.questionVersionId))) {
      throw new Error(
        "Question library pagination stopped before the complete collection was read.",
      );
    }
    for (const entry of next.entries) seen.add(entry.questionVersionId);
    entries.push(...next.entries);
    if (entries.length >= first.total) return { ...first, entries };
  }

  throw new Error("Question library pagination exceeded its page limit.");
}
