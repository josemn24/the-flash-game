import Image from "next/image";
import type { QuestionIllustration, QuestionMedia as QuestionMediaType } from "@/types/game";

function Illustration({ id }: { id: QuestionIllustration }) {
  if (id === "japan-flag") {
    return (
      <div className="japan-flag">
        <div className="japan-sun" />
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

  return (
    <>
      <div className="star star-one" />
      <div className="star star-two" />
      <div className="star star-three" />
      <div className="saturn">
        <div className="saturn-ring saturn-ring-back" />
        <div className="saturn-planet" />
        <div className="saturn-ring saturn-ring-front" />
      </div>
    </>
  );
}

export function QuestionMedia({ media }: { media: QuestionMediaType }) {
  if (media.type === "image") {
    const isSvg = media.src.endsWith(".svg");

    return (
      <div className="visual-stage">
        <Image
          src={media.src}
          alt={media.alt}
          fill
          sizes="(max-width: 768px) calc(100vw - 2rem), 48rem"
          unoptimized={isSvg}
          className={media.fit === "contain" ? "object-contain" : "object-cover"}
          style={{ objectPosition: media.position }}
        />
        <div className="visual-scanline" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={`visual-stage${media.id === "saturn" ? " visual-space" : ""}`}
      role="img"
      aria-label={media.alt}
    >
      <Illustration id={media.id} />
      <div className="visual-scanline" aria-hidden="true" />
    </div>
  );
}
