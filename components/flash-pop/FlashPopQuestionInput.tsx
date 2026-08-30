"use client";

import { AnswerOption } from "@/components/AnswerOption";
import { ClassificationQuestion } from "@/components/ClassificationQuestion";
import { ConnectPairsQuestion } from "@/components/ConnectPairsQuestion";
import { LogicCodeQuestion } from "@/components/LogicCodeQuestion";
import { LogicMatrixQuestion } from "@/components/LogicMatrixQuestion";
import { MatchingQuestion } from "@/components/MatchingQuestion";
import { MiniWordleQuestion } from "@/components/MiniWordleQuestion";
import { NumberSequencePrompt } from "@/components/NumberSequencePrompt";
import { OddOneOutQuestion } from "@/components/OddOneOutQuestion";
import { OrderingQuestion } from "@/components/OrderingQuestion";
import { ProgressiveCluesQuestion } from "@/components/ProgressiveCluesQuestion";
import { QueensQuestion } from "@/components/QueensQuestion";
import { WordHashtagQuestion } from "@/components/WordHashtagQuestion";
import { WordSearchQuestion } from "@/components/WordSearchQuestion";
import {
  isClassificationAnswer,
  isConnectPairsAnswer,
  isMatchingAnswer,
  isMiniWordleAnswer,
  isQueensAnswer,
  isWordHashtagAnswer,
  isWordSearchAnswer,
} from "@/lib/scoring";
import type {
  AnswerValue,
  ClassificationAnswer,
  ConnectPairsAnswer,
  MatchingAnswer,
  MiniWordleAnswer,
  PyramidLevel,
  QueensAnswer,
  WordHashtagAnswer,
  WordSearchAnswer,
} from "@/types/game";
import styles from "./FlashPopQuestionInput.module.css";

export type FlashPopQuestionInputProps = {
  level: PyramidLevel;
  levelIndex: number;
  levelCount: number;
  locked: boolean;
  initialAnswer?: AnswerValue | null;
  progressiveCluesRevealed?: number;
  onSubmit: (answer: AnswerValue) => void;
  onProgress: (answer: AnswerValue) => void;
  onIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onCodeAttempt: (code: string) => boolean;
  onTimedResponseStart: () => void;
  attemptCount?: number;
};

export function FlashPopQuestionInput({
  level,
  locked,
  initialAnswer,
  progressiveCluesRevealed = 1,
  onSubmit,
  onProgress,
  onIncorrectAttempt,
  onProgressiveClueReveal,
  onCodeAttempt,
  onTimedResponseStart,
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
    case "matching": {
      const matchingAnswer: MatchingAnswer | undefined = isMatchingAnswer(initialAnswer ?? null)
        ? (initialAnswer as MatchingAnswer)
        : undefined;
      return (
        <MatchingQuestion
          leftItems={question.leftItems}
          rightItems={question.rightItems}
          initialAnswer={matchingAnswer}
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onIncorrectAttempt={onIncorrectAttempt}
          onSubmit={(answer) => onSubmit(answer)}
          className={styles.flashPopFormat}
        />
      );
    }
    case "progressive-clues":
      return (
        <ProgressiveCluesQuestion
          questionId={question.id}
          clues={question.clues}
          cluePenalty={question.cluePenalty}
          points={question.points}
          initialAnswer={typeof initialAnswer === "string" ? initialAnswer : undefined}
          initialRevealedClues={progressiveCluesRevealed}
          locked={locked}
          onReveal={onProgressiveClueReveal}
          onProgress={(answer) => onProgress(answer)}
          onSubmit={(answer) => onSubmit(answer)}
          className={styles.flashPopFormat}
        />
      );
    case "mini-wordle": {
      const miniWordleAnswer: MiniWordleAnswer | undefined = isMiniWordleAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as MiniWordleAnswer)
        : undefined;
      return (
        <MiniWordleQuestion
          correctAnswer={question.correctAnswer}
          additionalGuesses={question.additionalGuesses}
          hint={question.hint}
          wordLength={question.wordLength}
          maxAttempts={question.maxAttempts}
          initialAnswer={miniWordleAnswer}
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onSubmit={(answer) => onSubmit(answer)}
          onTimedResponseStart={onTimedResponseStart}
          className={styles.flashPopFormat}
        />
      );
    }
    case "word-search": {
      const wordSearchAnswer: WordSearchAnswer | undefined = isWordSearchAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as WordSearchAnswer)
        : undefined;
      return (
        <WordSearchQuestion
          question={question}
          initialAnswer={wordSearchAnswer}
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onIncorrectAttempt={onIncorrectAttempt}
          onSubmit={(answer) => onSubmit(answer)}
          className={styles.flashPopFormat}
        />
      );
    }
    case "classification": {
      const classificationAnswer: ClassificationAnswer | undefined = isClassificationAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as ClassificationAnswer)
        : undefined;
      return (
        <ClassificationQuestion
          items={question.items}
          categories={question.categories}
          initialAnswer={classificationAnswer}
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onSubmit={(answer) => onSubmit(answer)}
          className={styles.flashPopFormat}
        />
      );
    }
    case "word-hashtag": {
      const wordHashtagAnswer: WordHashtagAnswer | undefined = isWordHashtagAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as WordHashtagAnswer)
        : undefined;
      return (
        <WordHashtagQuestion
          question={question}
          initialAnswer={wordHashtagAnswer}
          locked={locked}
          onProgress={(answer) => onProgress(answer)}
          onSubmit={(answer) => onSubmit(answer)}
          className={styles.flashPopFormat}
        />
      );
    }
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
