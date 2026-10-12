import { WordSearchBoard } from "@/components/questions";
import wordSearchStyles from "@/components/questions/formats/word-search/WordSearchQuestion.module.css";
import { CheckIcon } from "@/components/ui";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isWordSearchAnswer } from "@/lib/scoring";
import type { WordSearchAnswer } from "@/types/gameplay";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"word-search">>) {
  const answer: WordSearchAnswer = isWordSearchAnswer(result.answer)
    ? result.answer
    : { foundWordIds: [] };
  const details = result.details?.type === "word-search" ? result.details : undefined;
  const foundIds = new Set(answer.foundWordIds);
  return (
    <div className="grid gap-4">
      <div className={wordSearchStyles.reviewBoardTheme}>
        <WordSearchBoard question={question} foundWordIds={answer.foundWordIds} revealSolution />
      </div>
      <ul
        className={`${wordSearchStyles.wordList} ${styles.wordSearchReviewList}`}
        aria-label="Resultado de las palabras objetivo"
      >
        {question.targets.map((target) => {
          const found = foundIds.has(target.id);
          return (
            <li key={target.id} className={found ? styles.wordSearchReviewFound : ""}>
              {found ? <CheckIcon aria-hidden="true" /> : <span aria-hidden="true">•</span>}
              <span>{target.word}</span>
              <span className="sr-only">{found ? "encontrada" : "no encontrada"}</span>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Palabras encontradas</span>
          <strong>
            {details?.foundWords ?? answer.foundWordIds.length} de {question.targets.length}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Selecciones fallidas</span>
          <strong>{details?.incorrectSelections ?? 0} · sin penalización</strong>
        </div>
      </div>
    </div>
  );
}
