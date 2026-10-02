import type { FlashEditorialQuestion } from "@/types/contracts/stored-questions";
import { parseStored as anagramParser } from "./anagram/stored";
import { parseStored as classificationParser } from "./classification/stored";
import { parseStored as escapeParser } from "./escape/stored";
import { parseStored as estimationParser } from "./estimation/stored";
import { parseStored as heatMapParser } from "./heat-map/stored";
import { parseStored as logicCodeParser } from "./logic-code/stored";
import { parseStored as logicMatrixParser } from "./logic-matrix/stored";
import { parseStored as matchingParser } from "./matching/stored";
import { parseStored as miniWordleParser } from "./mini-wordle/stored";
import { parseStored as multipleChoiceParser } from "./multiple-choice/stored";
import { parseStored as oddOneOutParser } from "./odd-one-out/stored";
import { parseStored as orderingParser } from "./ordering/stored";
import { parseStored as progressiveCluesParser } from "./progressive-clues/stored";
import { parseStored as progressiveImageParser } from "./progressive-image/stored";
import { parseStored as shortTextParser } from "./short-text/stored";
import { FlashEditorialValidationError, isRecord } from "./stored-common";
import { parseStored as trueFalseParser } from "./true-false/stored";
import { parseStored as wordHashtagParser } from "./word-hashtag/stored";
import { parseStored as wordSearchParser } from "./word-search/stored";
import { parseStored as zipParser } from "./zip/stored";
export const EDITORIAL_FORMAT_PARSERS = {
  "word-search": wordSearchParser,
  "word-hashtag": wordHashtagParser,
  zip: zipParser,
  escape: escapeParser,
  "heat-map": heatMapParser,
  "multiple-choice": multipleChoiceParser,
  "short-text": shortTextParser,
  estimation: estimationParser,
  "mini-wordle": miniWordleParser,
  "logic-code": logicCodeParser,
  "logic-matrix": logicMatrixParser,
  "progressive-clues": progressiveCluesParser,
  matching: matchingParser,
  "true-false": trueFalseParser,
  "odd-one-out": oddOneOutParser,
  ordering: orderingParser,
  anagram: anagramParser,
  classification: classificationParser,
  "progressive-image": progressiveImageParser,
} satisfies Record<
  FlashEditorialQuestion["type"],
  (input: unknown, index?: number) => FlashEditorialQuestion
>;
export function parseEditorialQuestion(value: unknown, index: number): FlashEditorialQuestion {
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    !Object.hasOwn(EDITORIAL_FORMAT_PARSERS, value.type)
  )
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  return EDITORIAL_FORMAT_PARSERS[value.type as FlashEditorialQuestion["type"]](value, index);
}
