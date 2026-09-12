import { questionGroups } from "@/data/mock/catalog/questions/groups";
import { legacyQuestionsBySlug } from "@/data/mock/legacyQuestionAdapter";
/** @deprecated Proyección legacy; usa `mockDomainStore.questionVersions`. */
export const questionsById = legacyQuestionsBySlug;

export type KnownQuestionId = keyof typeof questionsById;

/** @deprecated Usa `KnownQuestionId`; los IDs canónicos viven en `@/types/domain`. */
export type QuestionId = KnownQuestionId;

export function getQuestionsByIds(ids: readonly KnownQuestionId[]) {
  return ids.map((id) => questionsById[id]);
}

export { questionGroups };
