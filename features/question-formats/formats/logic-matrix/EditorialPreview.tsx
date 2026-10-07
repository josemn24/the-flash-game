import styles from "@/components/admin/EditorialManagement.module.css";
import { LogicMatrixQuestion } from "@/components/questions/formats/logic-matrix/LogicMatrixQuestion";
import type { LogicMatrixQuestion as LegacyLogicMatrixQuestion } from "@/types/gameplay/practice";
import type { FlashEditorialQuestion } from "@/types/view-models/editorial";
import { QuestionFrame } from "../../editorialPreviewShared";
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "logic-matrix" }>,
  index: number,
) {
  const boardQuestion = {
    id: question.slug,
    type: "logic-matrix" as const,
    category: question.publicPayload.category ?? "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: question.publicPayload.question,
    pieces: [...question.publicPayload.pieces],
    cells: [...question.publicPayload.cells],
    optionIds: [...question.publicPayload.optionIds],
    correctOptionId: question.solutionPayload.correctOptionId,
    showPieceLabels: question.publicPayload.showPieceLabels ?? undefined,
    timeLimit: question.timeLimitMs / 1000,
    points: question.points,
    explanation: question.solutionPayload.explanation ?? "",
  } satisfies LegacyLogicMatrixQuestion;
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
    >
      <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
      <h4>{question.publicPayload.question}</h4>
      <LogicMatrixQuestion
        pieces={boardQuestion.pieces}
        cells={boardQuestion.cells}
        optionIds={boardQuestion.optionIds}
        showPieceLabels={boardQuestion.showPieceLabels}
        locked
        onSubmit={() => undefined}
      />
      <p className={styles.solution}>
        Solución privada:{" "}
        <strong>
          {boardQuestion.pieces.find((piece) => piece.id === boardQuestion.correctOptionId)
            ?.label ?? boardQuestion.correctOptionId}
        </strong>
      </p>
    </QuestionFrame>
  );
}
