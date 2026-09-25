import type { QuestionSlug } from "@/data/mock/catalog/questions";
import type { GameMode, JsonValue } from "@/types/domain";

export type MockPublishedChallenge = {
  readonly slug: string;
  readonly mode: GameMode;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly modeConfig: JsonValue;
  readonly items: readonly {
    readonly questionSlug: QuestionSlug;
    readonly points: number;
    readonly modeConfig: JsonValue;
  }[];
};

export function defineChallengeCatalog<const Catalog extends readonly MockPublishedChallenge[]>(
  catalog: Catalog,
) {
  return catalog;
}
