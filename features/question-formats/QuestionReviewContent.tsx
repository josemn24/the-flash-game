import type { ComponentType } from "react";
import type { ReviewProps } from "./rendererTypes";
import { QUESTION_REVIEW_RENDERERS } from "./reviewContentRegistry";

export { QUESTION_REVIEW_RENDERERS } from "./reviewContentRegistry";

export function QuestionReviewContent(props: ReviewProps) {
  const Renderer = QUESTION_REVIEW_RENDERERS[props.question.type] as ComponentType<ReviewProps>;
  return <Renderer {...props} />;
}
