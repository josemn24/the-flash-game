"use client";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { ReactNode } from "react";
import type { CompetitiveInput, CompetitiveInputByFormat } from "./competitiveInputTypes";
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
} satisfies {
  [T in CompetitiveQuestionType]: (props: CompetitiveInputByFormat[T]) => ReactNode;
};
export function CompetitiveQuestionInput({ input }: { input: CompetitiveInput }) {
  switch (input.format) {
    case "anagram":
      return <COMPETITIVE_INPUT_RENDERERS.anagram {...input.props} />;
    case "classification":
      return <COMPETITIVE_INPUT_RENDERERS.classification {...input.props} />;
    case "connect-pairs": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["connect-pairs"];
      return <Renderer {...input.props} />;
    }
    case "escape":
      return <COMPETITIVE_INPUT_RENDERERS.escape {...input.props} />;
    case "estimation":
      return <COMPETITIVE_INPUT_RENDERERS.estimation {...input.props} />;
    case "heat-map": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["heat-map"];
      return <Renderer {...input.props} />;
    }
    case "logic-code": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["logic-code"];
      return <Renderer {...input.props} />;
    }
    case "logic-matrix": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["logic-matrix"];
      return <Renderer {...input.props} />;
    }
    case "matching":
      return <COMPETITIVE_INPUT_RENDERERS.matching {...input.props} />;
    case "mini-wordle": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["mini-wordle"];
      return <Renderer {...input.props} />;
    }
    case "multiple-choice": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["multiple-choice"];
      return <Renderer {...input.props} />;
    }
    case "odd-one-out": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["odd-one-out"];
      return <Renderer {...input.props} />;
    }
    case "ordering":
      return <COMPETITIVE_INPUT_RENDERERS.ordering {...input.props} />;
    case "progressive-clues": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["progressive-clues"];
      return <Renderer {...input.props} />;
    }
    case "progressive-image": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["progressive-image"];
      return <Renderer {...input.props} />;
    }
    case "queens":
      return <COMPETITIVE_INPUT_RENDERERS.queens {...input.props} />;
    case "short-text": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["short-text"];
      return <Renderer {...input.props} />;
    }
    case "true-false": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["true-false"];
      return <Renderer {...input.props} />;
    }
    case "word-hashtag": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["word-hashtag"];
      return <Renderer {...input.props} />;
    }
    case "word-search": {
      const Renderer = COMPETITIVE_INPUT_RENDERERS["word-search"];
      return <Renderer {...input.props} />;
    }
    case "zip":
      return <COMPETITIVE_INPUT_RENDERERS.zip {...input.props} />;
    default:
      return unreachable(input);
  }
}
function unreachable(input: never): never {
  throw new Error(`Unsupported competitive input: ${JSON.stringify(input)}`);
}
