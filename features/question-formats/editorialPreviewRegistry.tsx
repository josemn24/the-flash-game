import styles from "@/components/admin/EditorialManagement.module.css";
import type {
  FlashEditorialQuestion,
  FlashEditorialQuestionReference,
} from "@/types/view-models/editorial";
import type { ReactNode } from "react";
import { QuestionFrame } from "./editorialPreviewShared";
import { renderEditorialPreview as escapePreview } from "./formats/escape/EditorialPreview";
import { renderEditorialPreview as logicCodePreview } from "./formats/logic-code/EditorialPreview";
import { renderEditorialPreview as logicMatrixPreview } from "./formats/logic-matrix/EditorialPreview";
import { renderEditorialPreview as matchingPreview } from "./formats/matching/EditorialPreview";
import { renderEditorialPreview as miniWordlePreview } from "./formats/mini-wordle/EditorialPreview";
import { renderEditorialPreview as multipleChoicePreview } from "./formats/multiple-choice/EditorialPreview";
import { renderEditorialPreview as progressiveCluesPreview } from "./formats/progressive-clues/EditorialPreview";
import { renderEditorialPreview as progressiveImagePreview } from "./formats/progressive-image/EditorialPreview";
import { renderEditorialPreview as wordSearchPreview } from "./formats/word-search/EditorialPreview";
import { renderEditorialPreview as zipPreview } from "./formats/zip/EditorialPreview";
function renderDefaultPreview(question: FlashEditorialQuestion, index: number) {
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
    >
      <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
      <h4>{question.publicPayload.question}</h4>
      <p className={styles.solution}>Vista previa específica disponible al ejecutar la pregunta.</p>
    </QuestionFrame>
  );
}
export const EDITORIAL_PREVIEW_RENDERERS = {
  "mini-wordle": miniWordlePreview,
  "logic-code": logicCodePreview,
  "progressive-clues": progressiveCluesPreview,
  matching: matchingPreview,
  "word-search": wordSearchPreview,
  zip: zipPreview,
  escape: escapePreview,
  "logic-matrix": logicMatrixPreview,
  "progressive-image": progressiveImagePreview,
  "multiple-choice": multipleChoicePreview,
  estimation: renderDefaultPreview,
  "heat-map": renderDefaultPreview,
  "true-false": renderDefaultPreview,
  "odd-one-out": renderDefaultPreview,
  ordering: renderDefaultPreview,
  anagram: renderDefaultPreview,
  classification: renderDefaultPreview,
  "word-hashtag": renderDefaultPreview,
  "short-text": renderDefaultPreview,
} satisfies {
  [T in FlashEditorialQuestion["type"]]: (
    question: Extract<FlashEditorialQuestion, { type: T }>,
    index: number,
  ) => ReactNode;
};
export function renderEditorialQuestion(
  question: FlashEditorialQuestion | FlashEditorialQuestionReference,
  index: number,
): ReactNode {
  if ("source" in question) {
    return (
      <QuestionFrame
        key={question.challengeItemId ?? question.questionVersionId}
        index={index}
        meta={`${question.points} puntos · biblioteca`}
      >
        <h4>Versión reutilizable</h4>
        <p className={styles.category}>{question.questionVersionId}</p>
        <p className={styles.solution}>
          La pregunta se resolverá desde la versión publicada seleccionada.
        </p>
      </QuestionFrame>
    );
  }
  const renderer = EDITORIAL_PREVIEW_RENDERERS[question.type] as (
    question: FlashEditorialQuestion,
    index: number,
  ) => ReactNode;
  return renderer(question, index);
}
