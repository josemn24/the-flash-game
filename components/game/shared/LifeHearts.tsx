import { HeartIcon } from "@/components/ui";
import styles from "./QuestionStageVariants.module.css";

export function LifeHearts({
  livesRemaining,
  totalLives,
}: {
  livesRemaining: number;
  totalLives: number;
}) {
  const safeTotalLives = Math.max(0, totalLives);
  const safeLivesRemaining = Math.min(Math.max(0, livesRemaining), safeTotalLives);

  return (
    <span
      className={styles.lifeHearts}
      aria-label={`${safeLivesRemaining} de ${safeTotalLives} vidas restantes`}
    >
      {Array.from({ length: safeTotalLives }, (_, index) => {
        const active = index < safeLivesRemaining;
        return (
          <HeartIcon
            key={index}
            className={`${styles.lifeHeart} ${active ? styles.lifeHeartActive : styles.lifeHeartLost}`}
          />
        );
      })}
    </span>
  );
}
