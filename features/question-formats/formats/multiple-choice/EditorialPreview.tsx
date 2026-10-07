import styles from "@/components/admin/EditorialManagement.module.css";
import { AnswerOption } from "@/components/questions/shared/AnswerOption";
import type { MultipleChoiceQuestion } from "@/types/gameplay/practice";
import type {
  FlashEditorialMultipleChoiceQuestion,
  FlashEditorialQuestion,
} from "@/types/view-models/editorial";
import { QuestionFrame } from "../../editorialPreviewShared";
function previewQuestion(question: FlashEditorialMultipleChoiceQuestion): MultipleChoiceQuestion {
  const tags = question.publicPayload.tags;
  const media = question.publicPayload.media;
  const runtimeMedia =
    media && (media.type === "illustration" || "src" in media) ? media : undefined;
  return {
    id: question.slug,
    type: "multiple-choice",
    category: question.publicPayload.category ?? "",
    tags: {
      domains: Array.isArray(tags?.domains) ? tags.domains : [],
      topics: Array.isArray(tags?.topics) ? tags.topics : [],
      cognitiveSkills: Array.isArray(tags?.cognitiveSkills) ? tags.cognitiveSkills : [],
      formatSkills: Array.isArray(tags?.formatSkills) ? tags.formatSkills : [],
      lifeSkills: Array.isArray(tags?.lifeSkills) ? tags.lifeSkills : [],
    } as MultipleChoiceQuestion["tags"],
    question: question.publicPayload.question,
    options: [...question.publicPayload.options],
    correctAnswer: question.solutionPayload.correctAnswer,
    timeLimit: question.timeLimitMs / 1000,
    points: question.points,
    explanation: question.solutionPayload.explanation ?? "",
    ...(runtimeMedia ? { media: runtimeMedia } : {}),
    ...(question.publicPayload.promptVisual
      ? { promptVisual: question.publicPayload.promptVisual }
      : {}),
  };
}
export function renderEditorialPreview(
  question: Extract<FlashEditorialQuestion, { type: "multiple-choice" }>,
  index: number,
) {
  const multipleChoice = previewQuestion(question as FlashEditorialMultipleChoiceQuestion);
  return (
    <QuestionFrame
      key={question.slug}
      index={index}
      meta={`${multipleChoice.timeLimit}s · ${multipleChoice.points} puntos`}
    >
      <p className={styles.category}>{multipleChoice.category}</p>
      <h4>{multipleChoice.question}</h4>
      <div className={styles.options}>
        {multipleChoice.options.map((option, optionIndex) => (
          <AnswerOption
            key={option}
            label={option}
            index={optionIndex}
            disabled
            onSelect={() => undefined}
          />
        ))}
      </div>
      <p className={styles.solution}>
        Solución privada: <strong>{multipleChoice.correctAnswer}</strong>
      </p>
    </QuestionFrame>
  );
}
