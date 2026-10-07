import styles from "@/components/admin/EditorialManagement.module.css";
import type { ReactNode } from "react";
export function QuestionFrame({
  index,
  meta,
  children,
}: {
  readonly index: number;
  readonly meta: string;
  readonly children: ReactNode;
}) {
  return (
    <article className={styles.previewQuestion}>
      <div className={styles.previewQuestionTopline}>
        <span className={styles.eyebrow}>Pregunta {String(index + 1).padStart(2, "0")}</span>
        <span className={styles.previewMeta}>{meta}</span>
      </div>
      {children}
    </article>
  );
}
