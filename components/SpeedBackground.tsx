import styles from "@/components/SpeedBackground.module.css";

export function SpeedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className={`${styles.ambientOrb} ${styles.ambientOrbOne}`} />
      <div className={`${styles.ambientOrb} ${styles.ambientOrbTwo}`} />
      <div className={styles.speedGrid} />
      <div className={`${styles.speedLine} ${styles.speedLineOne}`} />
      <div className={`${styles.speedLine} ${styles.speedLineTwo}`} />
      <div className={`${styles.speedLine} ${styles.speedLineThree}`} />
      <div className={styles.noiseLayer} />
    </div>
  );
}
