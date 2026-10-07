import styles from "@/components/admin/EditorialManagement.module.css";
import type { FlashEditorialQuestion } from "@/types/view-models/editorial";
import { QuestionFrame } from "../../editorialPreviewShared";
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "matching" }>,
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
      <div className={styles.options}>
        {question.publicPayload.leftItems.map((item) => (
          <p key={`left-${item.id}`}>
            <strong>{item.label}</strong> · {question.solutionPayload.matches[item.id]}
          </p>
        ))}
      </div>
      <p>{question.publicPayload.leftItems.length} parejas</p>
      <p className={styles.solution}>
        Solución privada:{" "}
        <strong>{Object.keys(question.solutionPayload.matches).length} correspondencias</strong>
      </p>
    </QuestionFrame>
  );
}
