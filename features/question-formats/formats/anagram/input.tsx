"use client";
import { AnagramQuestion } from "@/components/questions/formats/anagram/AnagramQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, onSubmit } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "anagram" }
  >;
  return (
    <>
      <AnagramQuestion
        tiles={[...question.tiles]}
        hint={question.hint ?? undefined}
        locked={locked}
        onSubmit={onSubmit}
      />
    </>
  );
}
