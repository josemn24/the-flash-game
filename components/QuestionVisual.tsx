import type { QuestionVisual as VisualType } from "@/types/game";

export function QuestionVisual({
  visual,
  alt,
}: {
  visual: VisualType;
  alt: string;
}) {
  if (visual === "japan-flag") {
    return (
      <div className="visual-stage" role="img" aria-label={alt}>
        <div className="japan-flag">
          <div className="japan-sun" />
        </div>
        <div className="visual-scanline" />
      </div>
    );
  }

  return (
    <div className="visual-stage visual-space" role="img" aria-label={alt}>
      <div className="star star-one" />
      <div className="star star-two" />
      <div className="star star-three" />
      <div className="saturn">
        <div className="saturn-ring saturn-ring-back" />
        <div className="saturn-planet" />
        <div className="saturn-ring saturn-ring-front" />
      </div>
      <div className="visual-scanline" />
    </div>
  );
}
