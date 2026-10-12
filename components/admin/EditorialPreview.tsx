import { Chip } from "@/components/ui";
import { renderEditorialQuestion } from "@/features/question-formats/editorialPreviewRegistry";
import type { FlashEditorialDocument } from "@/types/view-models/editorial";
import styles from "./EditorialManagement.module.css";
export function EditorialPreview({ document }: { readonly document: FlashEditorialDocument }) {
  return (
    <div className={styles.preview} aria-label="Previsualización editorial protegida">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Preview protegido</p>
          <h3>{document.challenge.title}</h3>
        </div>
        <Chip variant="data" tone="neutral">
          Sin intento ni puntuación
        </Chip>
      </div>
      <p className={styles.previewDescription}>{document.challenge.description}</p>
      <div className={styles.previewQuestions}>
        {document.questions.map(renderEditorialQuestion)}
      </div>
    </div>
  );
}
