import styles from "@/components/admin/EditorialManagement.module.css";
import type { FlashEditorialQuestion } from "@/types/view-models/editorial";
import Image from "next/image";
import { QuestionFrame } from "../../editorialPreviewShared";
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "progressive-image" }>,
  index: number,
) {
  const imageSrc =
    "src" in question.publicPayload.surface ? question.publicPayload.surface.src : undefined;
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${question.timeLimitMs / 1000}s · ${question.points} puntos`}
    >
      <p className={styles.category}>{question.publicPayload.category ?? ""}</p>
      <h4>{question.publicPayload.question}</h4>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={question.publicPayload.surface.alt}
          width={question.publicPayload.surface.width}
          height={question.publicPayload.surface.height}
        />
      ) : (
        <p className={styles.solution}>Asset privado: preview pendiente de URL firmada.</p>
      )}
      <p className={styles.solution}>
        Solución privada: <strong>{question.solutionPayload.correctAnswer}</strong>
      </p>
    </QuestionFrame>
  );
}
