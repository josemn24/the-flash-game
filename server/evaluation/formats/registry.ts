import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { ResolvedQuestion } from "@/types/gameplay/scoring";
import "server-only";
import { resolve as anagramResolver } from "./anagram";
import { resolve as classificationResolver } from "./classification";
import { resolve as connectPairsResolver } from "./connect-pairs";
import { resolve as escapeResolver } from "./escape";
import { resolve as estimationResolver } from "./estimation";
import { resolve as heatMapResolver } from "./heat-map";
import { resolve as logicCodeResolver } from "./logic-code";
import { resolve as logicMatrixResolver } from "./logic-matrix";
import { resolve as matchingResolver } from "./matching";
import { resolve as miniWordleResolver } from "./mini-wordle";
import { resolve as multipleChoiceResolver } from "./multiple-choice";
import { resolve as oddOneOutResolver } from "./odd-one-out";
import { resolve as orderingResolver } from "./ordering";
import { resolve as progressiveCluesResolver } from "./progressive-clues";
import { resolve as progressiveImageResolver } from "./progressive-image";
import { resolve as queensResolver } from "./queens";
import type { CanonicalQuestionResolutionInput } from "./shared";
import { resolve as shortTextResolver } from "./short-text";
import { resolve as trueFalseResolver } from "./true-false";
import { resolve as wordHashtagResolver } from "./word-hashtag";
import { resolve as wordSearchResolver } from "./word-search";
import { resolve as zipResolver } from "./zip";
export const COMPETITIVE_RESOLVERS = {
  "multiple-choice": multipleChoiceResolver,
  "odd-one-out": oddOneOutResolver,
  matching: matchingResolver,
  "connect-pairs": connectPairsResolver,
  "true-false": trueFalseResolver,
  "short-text": shortTextResolver,
  "progressive-clues": progressiveCluesResolver,
  "progressive-image": progressiveImageResolver,
  "heat-map": heatMapResolver,
  ordering: orderingResolver,
  classification: classificationResolver,
  "logic-matrix": logicMatrixResolver,
  queens: queensResolver,
  zip: zipResolver,
  escape: escapeResolver,
  anagram: anagramResolver,
  "word-hashtag": wordHashtagResolver,
  "word-search": wordSearchResolver,
  "mini-wordle": miniWordleResolver,
  "logic-code": logicCodeResolver,
  estimation: estimationResolver,
} satisfies Record<
  CompetitiveQuestionType,
  (input: CanonicalQuestionResolutionInput) => ResolvedQuestion
>;
