import Image from "next/image";
import styles from "@/components/QuestionMedia.module.css";
import type { QuestionIllustration, QuestionMedia as QuestionMediaType } from "@/types/game";

function Illustration({ id }: { id: QuestionIllustration }) {
  if (id === "japan-flag") {
    return (
      <div className={styles.japanFlag}>
        <div className={styles.japanSun} />
      </div>
    );
  }

  if (id === "italy-flag") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 300 200"
        className="h-auto w-[min(63%,18rem)] rounded-[0.3rem] shadow-2xl"
      >
        <rect width="100" height="200" fill="#16814d" />
        <rect x="100" width="100" height="200" fill="#f2f0e8" />
        <rect x="200" width="100" height="200" fill="#ce3e45" />
      </svg>
    );
  }

  if (id === "france-flag") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 300 200"
        className="h-auto w-[min(63%,18rem)] rounded-[0.3rem] shadow-2xl"
      >
        <rect width="100" height="200" fill="#1b3f8b" />
        <rect x="100" width="100" height="200" fill="#f2f0e8" />
        <rect x="200" width="100" height="200" fill="#d43c4c" />
      </svg>
    );
  }

  return (
    <>
      <div className={`${styles.star} ${styles.starOne}`} />
      <div className={`${styles.star} ${styles.starTwo}`} />
      <div className={`${styles.star} ${styles.starThree}`} />
      <div className={styles.saturn}>
        <div className={`${styles.saturnRing} ${styles.saturnRingBack}`} />
        <div className={styles.saturnPlanet} />
        <div className={`${styles.saturnRing} ${styles.saturnRingFront}`} />
      </div>
    </>
  );
}

export function QuestionMedia({
  media,
  compact = false,
}: {
  media: QuestionMediaType;
  compact?: boolean;
}) {
  const stageClassName = `${styles.visualStage} ${compact ? styles.visualStageCompact : ""}`;

  if (media.type === "image") {
    const isSvg = media.src.endsWith(".svg");

    return (
      <div className={stageClassName}>
        <Image
          src={media.src}
          alt={media.alt}
          fill
          sizes="(max-width: 768px) calc(100vw - 2rem), 48rem"
          unoptimized={isSvg}
          className={media.fit === "contain" ? "object-contain" : "object-cover"}
          style={{ objectPosition: media.position }}
        />
        <div className={styles.visualScanline} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={`${stageClassName} ${media.id === "saturn" ? styles.visualSpace : ""}`}
      role="img"
      aria-label={media.alt}
    >
      <Illustration id={media.id} />
      <div className={styles.visualScanline} aria-hidden="true" />
    </div>
  );
}
