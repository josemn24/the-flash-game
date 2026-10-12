"use client";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { ReactNode } from "react";
import type { CompetitiveInputProps } from "./competitiveInputTypes";
import { render as anagramInput } from "./formats/anagram/input";
import { render as classificationInput } from "./formats/classification/input";
import { render as connectPairsInput } from "./formats/connect-pairs/input";
import { render as escapeInput } from "./formats/escape/input";
import { render as estimationInput } from "./formats/estimation/input";
import { render as heatMapInput } from "./formats/heat-map/input";
import { render as logicCodeInput } from "./formats/logic-code/input";
import { render as logicMatrixInput } from "./formats/logic-matrix/input";
import { render as matchingInput } from "./formats/matching/input";
import { render as miniWordleInput } from "./formats/mini-wordle/input";
import { render as multipleChoiceInput } from "./formats/multiple-choice/input";
import { render as oddOneOutInput } from "./formats/odd-one-out/input";
import { render as orderingInput } from "./formats/ordering/input";
import { render as progressiveCluesInput } from "./formats/progressive-clues/input";
import { render as progressiveImageInput } from "./formats/progressive-image/input";
import { render as queensInput } from "./formats/queens/input";
import { render as shortTextInput } from "./formats/short-text/input";
import { render as trueFalseInput } from "./formats/true-false/input";
import { render as wordHashtagInput } from "./formats/word-hashtag/input";
import { render as wordSearchInput } from "./formats/word-search/input";
import { render as zipInput } from "./formats/zip/input";
export const COMPETITIVE_INPUT_RENDERERS = {
  "mini-wordle": miniWordleInput,
  "logic-code": logicCodeInput,
  "progressive-clues": progressiveCluesInput,
  matching: matchingInput,
  "progressive-image": progressiveImageInput,
  queens: queensInput,
  "word-search": wordSearchInput,
  "word-hashtag": wordHashtagInput,
  "logic-matrix": logicMatrixInput,
  zip: zipInput,
  escape: escapeInput,
  "connect-pairs": connectPairsInput,
  "true-false": trueFalseInput,
  "odd-one-out": oddOneOutInput,
  ordering: orderingInput,
  anagram: anagramInput,
  classification: classificationInput,
  estimation: estimationInput,
  "heat-map": heatMapInput,
  "multiple-choice": multipleChoiceInput,
  "short-text": shortTextInput,
} satisfies Record<CompetitiveQuestionType, (props: CompetitiveInputProps) => ReactNode>;
export function CompetitiveQuestionInput(props: CompetitiveInputProps) {
  const Renderer = COMPETITIVE_INPUT_RENDERERS[props.question.type];
  return <Renderer {...props} />;
}
