import styles from "@/components/admin/EditorialManagement.module.css";
import { EscapeBoard } from "@/components/questions/formats/escape/EscapeQuestion";
import { replayEscapeMoves } from "@/lib/escape";
import type { EscapeQuestion as LegacyEscapeQuestion } from "@/types/gameplay/practice";
import type { FlashEditorialQuestion } from "@/types/view-models/editorial";
import { QuestionFrame } from "../../editorialPreviewShared";
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "escape" }>,
  index: number,
) {
  const boardQuestion = {
    id: question.slug,
    type: "escape" as const,
    category: question.publicPayload.category ?? "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: question.publicPayload.question,
    grid: question.publicPayload.grid,
    initialBlocks: [...question.publicPayload.initialBlocks],
    referenceSolution: [...question.solutionPayload.referenceSolution],
    optimalMoves: question.solutionPayload.optimalMoves,
    instruction: question.publicPayload.instruction,
    hideInstruction: question.publicPayload.hideInstruction,
    objectiveLabel: question.publicPayload.objectiveLabel,
    hideObjectiveLabel: question.publicPayload.hideObjectiveLabel,
    completionMessage: question.publicPayload.completionMessage,
    boardLabel: question.publicPayload.boardLabel,
    timeLimit: question.timeLimitMs / 1000,
    points: question.points,
    explanation: question.solutionPayload.explanation ?? "",
  } satisfies LegacyEscapeQuestion;
  const reference = replayEscapeMoves(boardQuestion, boardQuestion.referenceSolution);
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
    >
      <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
      <h4>{question.publicPayload.question}</h4>
      <EscapeBoard
        question={boardQuestion}
        blocks={reference.blocks}
        label="Solución de referencia de Escape"
      />
      <p className={styles.solution}>
        Solución privada:{" "}
        <strong>{question.solutionPayload.optimalMoves} movimientos óptimos</strong>
      </p>
    </QuestionFrame>
  );
}
