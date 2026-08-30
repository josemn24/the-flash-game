"use client";

import { AnswerOption } from "@/components/AnswerOption";
import { ConnectPairsQuestion } from "@/components/ConnectPairsQuestion";
import { LogicCodeQuestion } from "@/components/LogicCodeQuestion";
import { LogicMatrixQuestion } from "@/components/LogicMatrixQuestion";
import { NumberSequencePrompt } from "@/components/NumberSequencePrompt";
import { OddOneOutQuestion } from "@/components/OddOneOutQuestion";
import { OrderingQuestion } from "@/components/OrderingQuestion";
import { QueensQuestion } from "@/components/QueensQuestion";
import { isConnectPairsAnswer, isQueensAnswer } from "@/lib/scoring";
import type { AnswerValue, ConnectPairsAnswer, PyramidLevel, QueensAnswer } from "@/types/game";
import styles from "./FlashPopQuestionInput.module.css";

export type FlashPopQuestionInputProps = {
  level: PyramidLevel;
  levelIndex: number;
  levelCount: number;
  locked: boolean;
  initialAnswer?: AnswerValue | null;
  onSubmit: (answer: AnswerValue) => void;
  onProgress: (answer: AnswerValue) => void;
  onIncorrectAttempt: () => void;
  onCodeAttempt: (code: string) => boolean;
  onTimedResponseStart: () => void;
  attemptCount?: number;
};

export function FlashPopQuestionInput({
  level,
  locked,
  initialAnswer,
  onSubmit,
  onProgress,
  onIncorrectAttempt,
  onCodeAttempt,
  attemptCount = 0,
}: FlashPopQuestionInputProps) {
  const question = level.question;

  switch (question.type) {
    case "odd-one-out":
      return (
        <OddOneOutQuestion
          items={question.items}
          locked={locked}
          onSubmit={onSubmit}
          variant="flash-pop"
        />
      );
    case "multiple-choice":
      return (
        <div className={styles.choiceInput}>
          {question.promptVisual?.type === "number-sequence" && (
            <NumberSequencePrompt prompt={question.promptVisual} variant="flash-pop" />
          )}
          <div className={styles.choiceGrid} aria-label="Opciones de respuesta">
            {question.options.map((option, index) => (
              <AnswerOption
                key={option}
                label={option}
                index={index}
                disabled={locked}
                onSelect={() => onSubmit(option)}
                variant="flash-pop"
              />
            ))}
          </div>
        </div>
      );
    case "ordering":
      return (
        <OrderingQuestion
          items={question.items}
          directionLabels={question.directionLabels}
          initialItems={
            Array.isArray(initialAnswer) && initialAnswer.every((item) => typeof item === "string")
              ? initialAnswer
              : undefined
          }
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onSubmit={(answer) => onSubmit(answer)}
          variant="flash-pop"
        />
      );
    case "logic-matrix":
      return (
        <LogicMatrixQuestion
          pieces={question.pieces}
          cells={question.cells}
          optionIds={question.optionIds}
          showPieceLabels={question.showPieceLabels}
          locked={locked}
          onSubmit={onSubmit}
          variant="flash-pop"
        />
      );
    case "connect-pairs": {
      const connectAnswer: ConnectPairsAnswer | undefined = isConnectPairsAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as ConnectPairsAnswer)
        : undefined;
      return (
        <ConnectPairsQuestion
          question={question}
          initialAnswer={connectAnswer}
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onSubmit={(answer) => onSubmit(answer)}
          variant="flash-pop"
        />
      );
    }
    case "logic-code":
      return (
        <LogicCodeQuestion
          clues={question.clues}
          codeLength={question.codeLength}
          initialDraft={typeof initialAnswer === "string" ? initialAnswer : undefined}
          locked={locked}
          attemptCount={attemptCount}
          onProgress={(answer) => onProgress(answer)}
          onAttempt={onCodeAttempt}
          variant="flash-pop"
        />
      );
    case "queens": {
      const queensAnswer: Partial<QueensAnswer> | undefined = isQueensAnswer(initialAnswer ?? null)
        ? (initialAnswer as QueensAnswer)
        : undefined;
      return (
        <QueensQuestion
          question={question}
          initialAnswer={queensAnswer}
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onIncorrectAttempt={onIncorrectAttempt}
          onSubmit={(answer) => onSubmit(answer)}
          variant="flash-pop"
        />
      );
    }
    default:
      return (
        <p className={styles.unsupported} role="alert">
          Este nivel todavía no está disponible en Flash Pop.
        </p>
      );
  }
}
