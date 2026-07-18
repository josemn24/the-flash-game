import type { ComponentType } from "react";
import { HeatMapSurface } from "@/components/HeatMapQuestion";
import { ImageLabelingReviewSurface } from "@/components/ImageLabelingQuestion";
import styles from "@/components/ReviewAnswers.module.css";
import { isClassificationAnswer, isImageLabelingAnswer, isMatchingAnswer } from "@/lib/scoring";
import type {
  AnswerResult,
  AnswerValue,
  Question,
  QuestionOfType,
  QuestionType,
} from "@/types/game";

type ReviewProps<T extends Question = Question> = { question: T; result: AnswerResult };

function answerLabel(value: AnswerValue | null) {
  if (value === null) return "Sin respuesta";
  if (Array.isArray(value)) return value.join(" → ");
  if (typeof value === "boolean") return value ? "Verdadero" : "Falso";
  if (typeof value === "object") return "Clasificación completada";
  return value;
}

function categoryLabel(category: string | undefined) {
  if (!category) return "Sin respuesta";
  return category.charAt(0).toLocaleUpperCase("es") + category.slice(1);
}

function AnswerPair({ answer, correct }: { answer: AnswerValue | null; correct: AnswerValue }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={styles.answerBox}>
        <span>Tu respuesta</span>
        <strong>{answerLabel(answer)}</strong>
      </div>
      <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
        <span>Respuesta correcta</span>
        <strong>{answerLabel(correct)}</strong>
      </div>
    </div>
  );
}

function ChoiceReview({ question, result }: ReviewProps<QuestionOfType<"multiple-choice">>) {
  return <AnswerPair answer={result.answer} correct={question.correctAnswer} />;
}

function OddOneOutReview({ question, result }: ReviewProps<QuestionOfType<"odd-one-out">>) {
  const labelFor = (id: AnswerValue | null) =>
    typeof id === "string"
      ? (question.items.find((item) => item.id === id)?.label ?? "Respuesta no válida")
      : null;

  return (
    <AnswerPair
      answer={labelFor(result.answer)}
      correct={labelFor(question.correctAnswer) ?? question.correctAnswer}
    />
  );
}

function MatchingReview({ question, result }: ReviewProps<QuestionOfType<"matching">>) {
  const answer = isMatchingAnswer(result.answer) ? result.answer : null;
  return (
    <div className={styles.classificationReviewList}>
      {question.leftItems.map((item) => {
        const chosenId = answer?.[item.id];
        const chosenLabel = question.rightItems.find((right) => right.id === chosenId)?.label;
        const correctLabel = question.rightItems.find(
          (right) => right.id === item.correctMatchId,
        )?.label;
        const correct = chosenId === item.correctMatchId;
        return (
          <div key={item.id} className={styles.classificationReviewRow}>
            <strong>{item.label}</strong>
            <span>
              <small>Emparejada</small>
              <b
                className={
                  correct ? styles.classificationValueCorrect : styles.classificationValueWrong
                }
              >
                {chosenLabel ?? "Sin emparejar"}
              </b>
            </span>
            <span>
              <small>Correcta</small>
              <b className={styles.classificationValueCorrect}>{correctLabel}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrueFalseReview({ question, result }: ReviewProps<QuestionOfType<"true-false">>) {
  return <AnswerPair answer={result.answer} correct={question.correctAnswer} />;
}

function ShortTextReview({ question, result }: ReviewProps<QuestionOfType<"short-text">>) {
  return <AnswerPair answer={result.answer} correct={question.correctAnswer} />;
}

function ProgressiveCluesReview({
  question,
  result,
}: ReviewProps<QuestionOfType<"progressive-clues">>) {
  const details = result.details?.type === "progressive-clues" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <AnswerPair answer={result.answer} correct={question.correctAnswer} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Pistas utilizadas</span>
          <strong>
            {details ? `${details.revealedClues} de ${details.totalClues}` : "Sin datos"}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Máximo disponible</span>
          <strong>{details ? `${details.availablePoints} pts` : "—"}</strong>
        </div>
      </div>
    </div>
  );
}

function HeatMapReview({ question, result }: ReviewProps<QuestionOfType<"heat-map">>) {
  const details = result.details?.type === "heat-map" ? result.details : undefined;

  return (
    <div className="grid gap-3">
      <HeatMapSurface
        surface={question.surface}
        selectedPoint={details?.selectedPoint}
        targetPoint={question.target}
        fullCreditRadius={question.fullCreditRadius}
        toleranceRadius={question.toleranceRadius}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Tu selección</span>
          <strong>{details ? "Punto sobre la imagen" : "Sin respuesta"}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Zona objetivo</span>
          <strong>{question.targetLabel}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Precisión</span>
          <strong>{details ? `${Math.round(details.accuracy * 100)} %` : "—"}</strong>
          {details && (
            <small>Distancia: {(details.distance * 100).toFixed(1)} % del lado corto</small>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageLabelingReview({ question, result }: ReviewProps<QuestionOfType<"image-labeling">>) {
  const answer = isImageLabelingAnswer(result.answer) ? result.answer : null;
  const details = result.details?.type === "image-labeling" ? result.details : undefined;

  return (
    <div className="grid gap-3">
      <ImageLabelingReviewSurface question={question} answer={answer} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Etiquetas correctas</span>
          <strong>
            {details ? `${details.correctLabels} de ${details.totalLabels}` : "Sin respuesta"}
          </strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Resultado</span>
          <strong>
            {details ? `${Math.round((details.correctLabels / details.totalLabels) * 100)} %` : "—"}
          </strong>
        </div>
      </div>
    </div>
  );
}

function OrderingReview({ question, result }: ReviewProps<QuestionOfType<"ordering">>) {
  return <AnswerPair answer={result.answer} correct={question.correctOrder} />;
}

function EstimationReview({ question, result }: ReviewProps<QuestionOfType<"estimation">>) {
  const details = result.details?.type === "estimation" ? result.details : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className={styles.answerBox}>
        <span>Tu estimación</span>
        <strong>
          {typeof result.answer === "number"
            ? `${result.answer} ${question.unit}`
            : "Sin respuesta"}
        </strong>
      </div>
      <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
        <span>Valor real</span>
        <strong>
          {question.correctAnswer} {question.unit}
        </strong>
      </div>
      <div className={styles.answerBox}>
        <span>Diferencia</span>
        <strong>
          {typeof result.answer !== "number" || !details
            ? "—"
            : details.difference === 0
              ? "Exacta"
              : `${details.difference} ${question.unit} ${result.answer > question.correctAnswer ? "por encima" : "por debajo"}`}
        </strong>
      </div>
    </div>
  );
}

function LogicCodeReview({ question, result }: ReviewProps<QuestionOfType<"logic-code">>) {
  const details = result.details?.type === "logic-code" ? result.details : undefined;
  return (
    <div>
      <div className={styles.logicReviewClues}>
        {question.clues.map((clue) => (
          <div key={clue.code}>
            <strong>{clue.code}</strong>
            <span>{clue.hint}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Códigos enviados</span>
          {details?.submittedCodes.length ? (
            <div className={styles.logicReviewAttempts}>
              {details.submittedCodes.map((code, index) => (
                <b
                  key={`${code}-${index}`}
                  className={
                    index === details.submittedCodes.length - 1 ? styles.logicReviewLast : ""
                  }
                >
                  {code}
                </b>
              ))}
            </div>
          ) : (
            <strong>Sin respuesta</strong>
          )}
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Solución</span>
          <strong>{question.correctAnswer}</strong>
        </div>
      </div>
    </div>
  );
}

function ClassificationReview({ question, result }: ReviewProps<QuestionOfType<"classification">>) {
  const answer = isClassificationAnswer(result.answer) ? result.answer : null;
  return (
    <div className={styles.classificationReviewList}>
      {question.items.map((item) => {
        const chosenCategory = answer?.[item.label];
        const correct = chosenCategory === item.correctCategory;
        return (
          <div key={item.label} className={styles.classificationReviewRow}>
            <strong>{item.label}</strong>
            <span>
              <small>Elegida</small>
              <b
                className={
                  correct ? styles.classificationValueCorrect : styles.classificationValueWrong
                }
              >
                {categoryLabel(chosenCategory)}
              </b>
            </span>
            <span>
              <small>Correcta</small>
              <b className={styles.classificationValueCorrect}>
                {categoryLabel(item.correctCategory)}
              </b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const QUESTION_REVIEW_RENDERERS = {
  "multiple-choice": ChoiceReview,
  "odd-one-out": OddOneOutReview,
  matching: MatchingReview,
  "true-false": TrueFalseReview,
  "short-text": ShortTextReview,
  "progressive-clues": ProgressiveCluesReview,
  "heat-map": HeatMapReview,
  "image-labeling": ImageLabelingReview,
  ordering: OrderingReview,
  classification: ClassificationReview,
  "logic-code": LogicCodeReview,
  estimation: EstimationReview,
} satisfies { [T in QuestionType]: ComponentType<ReviewProps<QuestionOfType<T>>> };

export function QuestionReviewContent(props: ReviewProps) {
  const Renderer = QUESTION_REVIEW_RENDERERS[props.question.type] as ComponentType<ReviewProps>;
  return <Renderer {...props} />;
}
