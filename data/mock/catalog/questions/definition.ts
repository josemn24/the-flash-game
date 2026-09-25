import type {
  QuestionType,
  StoredPrivateQuestionPayload,
  StoredPublicQuestionPayload,
} from "@/types/contracts";

type FixtureValue<Value> = Value extends number
  ? number
  : Value extends readonly (infer Item)[]
    ? readonly FixtureValue<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: FixtureValue<Value[Key]> }
      : Value;

export type MockPublishedQuestion<Type extends QuestionType = QuestionType> = {
  readonly slug: string;
  readonly practicePoints: number;
  readonly type: Type;
  readonly publicPayload: FixtureValue<StoredPublicQuestionPayload<Type>>;
  readonly privatePayload: FixtureValue<StoredPrivateQuestionPayload<Type>>;
};

export type AnyMockPublishedQuestion = {
  [Type in QuestionType]: MockPublishedQuestion<Type>;
}[QuestionType];

export function defineQuestionCatalog<const Catalog extends readonly AnyMockPublishedQuestion[]>(
  catalog: Catalog,
) {
  return catalog;
}
