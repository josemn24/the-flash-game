import styles from "./NumberSequencePrompt.module.css";
import type { NumberSequencePromptVisual, QuestionVariant } from "@/types/game";

type NumberSequencePromptProps = {
  prompt: NumberSequencePromptVisual;
  variant?: QuestionVariant;
};

export function NumberSequencePrompt({ prompt, variant }: NumberSequencePromptProps) {
  return (
    <section
      className={`${styles.prompt}`}
      aria-label={prompt.eyebrow ?? "Secuencia numérica"}
      data-variant={variant ?? "default"}
    >
      {prompt.eyebrow && <p className={styles.eyebrow}>{prompt.eyebrow}</p>}
      <div className={styles.sequenceRow} aria-label={`Secuencia: ${prompt.sequence.join(", ")}`}>
        {prompt.sequence.map((item, index) => (
          <span className={styles.sequenceItem} key={`${item}-${index}`}>
            {item}
          </span>
        ))}
      </div>
      {prompt.differences && prompt.differences.length > 0 && (
        <div
          className={styles.differenceRow}
          aria-label={`Diferencias: ${prompt.differences.join(", ")}`}
        >
          {prompt.differences.map((difference, index) => (
            <span className={styles.differenceItem} key={`${difference}-${index}`}>
              {difference}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
