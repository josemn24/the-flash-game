import styles from "@/components/admin/EditorialManagement.module.css";
import type { FlashEditorialQuestion } from "@/types/view-models/editorial";
import { QuestionFrame } from "../../editorialPreviewShared";
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "mini-wordle" }>,
  index: number,
) {
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
    >
      <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
      <h4>{question.publicPayload.question}</h4>
      <p>
        {question.publicPayload.hint ?? "Sin pista"} · {question.publicPayload.wordLength} letras ·{" "}
        {question.publicPayload.maxAttempts} intentos
      </p>
      <p className={styles.solution}>
        Solución privada: <strong>{question.solutionPayload.correctAnswer}</strong>
      </p>
    </QuestionFrame>
  );
}
