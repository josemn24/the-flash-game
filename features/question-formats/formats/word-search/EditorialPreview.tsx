import styles from "@/components/admin/EditorialManagement.module.css";
import { WordSearchBoard } from "@/components/questions/formats/word-search/WordSearchQuestion";
import type { WordSearchQuestion as LegacyWordSearchQuestion } from "@/types/gameplay/practice";
import type { FlashEditorialQuestion } from "@/types/view-models/editorial";
import { QuestionFrame } from "../../editorialPreviewShared";
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "word-search" }>,
  index: number,
) {
  const positions = question.solutionPayload.positionsByTargetId;
  const boardQuestion = {
    id: question.slug,
    type: "word-search" as const,
    category: question.publicPayload.category ?? "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: question.publicPayload.question,
    grid: question.publicPayload.grid,
    letters: [...question.publicPayload.letters],
    targets: question.publicPayload.targets.map((target) => ({
      ...target,
      startCell: positions[target.id]!.startCell,
      endCell: positions[target.id]!.endCell,
    })),
    timeLimit: question.timeLimitMs / 1000,
    points: question.points,
    explanation: question.solutionPayload.explanation ?? "",
  } satisfies LegacyWordSearchQuestion;
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
    >
      <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
      <h4>{question.publicPayload.question}</h4>
      <WordSearchBoard question={boardQuestion} foundWordIds={[]} revealSolution />
      <p>
        {question.publicPayload.targets.length} palabras · {question.publicPayload.grid.rows}×
        {question.publicPayload.grid.columns}
      </p>
      <p className={styles.solution}>
        Solución privada: <strong>{Object.keys(positions).length} posiciones</strong>
      </p>
    </QuestionFrame>
  );
}
