import { HeartIcon } from "@/components/ui";
import styles from "./QuestionStageVariants.module.css";

export function LifeHearts({
  livesRemaining,
  totalLives,
  ariaLabel,
  className,
  emphasizeLastLife = false,
}: {
  livesRemaining: number;
  totalLives: number;
  ariaLabel?: string;
  className?: string;
  emphasizeLastLife?: boolean;
}) {
  const safeTotalLives = Math.max(0, totalLives);
  const safeLivesRemaining = Math.min(Math.max(0, livesRemaining), safeTotalLives);

  return (
    <span
      className={`${styles.lifeHearts} ${className ?? ""}`}
      aria-label={ariaLabel ?? `${safeLivesRemaining} de ${safeTotalLives} vidas restantes`}
    >
      {Array.from({ length: safeTotalLives }, (_, index) => {
        const active = index < safeLivesRemaining;
        return (
          <HeartIcon
            key={index}
            className={`${styles.lifeHeart} ${active ? styles.lifeHeartActive : styles.lifeHeartLost} ${emphasizeLastLife && safeLivesRemaining === 1 && active ? styles.lifeHeartLast : ""}`}
          />
        );
      })}
    </span>
  );
}
