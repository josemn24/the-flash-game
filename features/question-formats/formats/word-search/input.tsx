"use client";
import { ServerWordSearchQuestion } from "@/components/questions/formats/word-search/ServerWordSearchQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const {
    locked,
    wordSearchState,
    wordSearchStatusVisible,
    wordSearchError,
    lastWordSearchSelection,
    onWordSearchSelection,
    onRetryWordSearch,
  } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "word-search" }
  >;
  return (
    <ServerWordSearchQuestion
      question={question}
      progress={question.progress}
      locked={locked}
      selectionState={wordSearchState}
      selectionStatusVisible={wordSearchStatusVisible}
      selectionError={wordSearchError}
      lastSelection={lastWordSearchSelection}
      onSelect={onWordSearchSelection}
      onRetry={onRetryWordSearch}
    />
  );
}
