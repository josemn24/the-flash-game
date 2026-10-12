import styles from "@/components/admin/EditorialManagement.module.css";
import { ZipBoard } from "@/components/questions/formats/zip/ZipQuestion";
import type { ZipQuestion as LegacyZipQuestion } from "@/types/gameplay/practice";
import type { FlashEditorialQuestion } from "@/types/view-models/editorial";
import { QuestionFrame } from "../../editorialPreviewShared";
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "zip" }>,
  index: number,
) {
  const boardQuestion = {
    id: question.slug,
    type: "zip" as const,
    category: question.publicPayload.category ?? "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: question.publicPayload.question,
    grid: question.publicPayload.grid,
    checkpoints: [...question.publicPayload.checkpoints],
    solution: [...question.solutionPayload.solution],
    instruction: question.publicPayload.instruction,
    mapNote: question.publicPayload.mapNote,
    boardLabel: question.publicPayload.boardLabel,
    timeLimit: question.timeLimitMs / 1000,
    points: question.points,
    explanation: question.solutionPayload.explanation ?? "",
  } satisfies LegacyZipQuestion;
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
    >
      <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
      <h4>{question.publicPayload.question}</h4>
      <ZipBoard question={boardQuestion} path={[]} solutionPath={boardQuestion.solution} disabled />
      <p className={styles.solution}>
        Solución privada: <strong>{boardQuestion.solution.length} celdas verificadas</strong>
      </p>
    </QuestionFrame>
  );
}
