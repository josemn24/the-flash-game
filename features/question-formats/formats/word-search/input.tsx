"use client";
import { ServerWordSearchQuestion } from "@/components/questions/formats/word-search/ServerWordSearchQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"word-search">) {
  const {
    locked,
    wordSearchState,
    wordSearchStatusVisible,
    wordSearchError,
    lastWordSearchSelection,
    onWordSearchSelection,
    onRetryWordSearch,
  } = props;
  const { question } = props;
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
