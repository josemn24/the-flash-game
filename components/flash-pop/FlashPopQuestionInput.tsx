"use client";

import { AnagramQuestion } from "@/components/AnagramQuestion";
import { AnswerOption } from "@/components/AnswerOption";
import { ClassificationQuestion } from "@/components/ClassificationQuestion";
import { ConnectPairsQuestion } from "@/components/ConnectPairsQuestion";
import { EstimationQuestion } from "@/components/EstimationQuestion";
import { HeatMapQuestion } from "@/components/HeatMapQuestion";
import { LogicCodeQuestion } from "@/components/LogicCodeQuestion";
import { LogicMatrixQuestion } from "@/components/LogicMatrixQuestion";
import { MatchingQuestion } from "@/components/MatchingQuestion";
import { MiniWordleQuestion } from "@/components/MiniWordleQuestion";
import { NumberSequencePrompt } from "@/components/NumberSequencePrompt";
import { OddOneOutQuestion } from "@/components/OddOneOutQuestion";
import { OrderingQuestion } from "@/components/OrderingQuestion";
import { ProgressiveImageQuestion } from "@/components/ProgressiveImageQuestion";
import { ProgressiveCluesQuestion } from "@/components/ProgressiveCluesQuestion";
import { QueensQuestion } from "@/components/QueensQuestion";
import { TrueFalseQuestion } from "@/components/TrueFalseQuestion";
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
  QueensAnswer,
  Question,
  WordHashtagAnswer,
  WordSearchAnswer,
} from "@/types/game";
import styles from "./FlashPopQuestionInput.module.css";

export type FlashPopQuestionInputProps = {
  question: Question;
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
  question,
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
  switch (question.type) {
    case "true-false":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <TrueFalseQuestion locked={locked} onSubmit={onSubmit} variant="flash-pop" />
        </div>
      );
    case "odd-one-out":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <OddOneOutQuestion
            items={question.items}
            locked={locked}
            onSubmit={onSubmit}
            variant="flash-pop"
          />
        </div>
      );
    case "multiple-choice":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat} ${styles.choiceInput}`}
          data-format={question.type}
        >
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
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <OrderingQuestion
            items={question.items}
            directionLabels={question.directionLabels}
            initialItems={
              Array.isArray(initialAnswer) &&
              initialAnswer.every((item) => typeof item === "string")
                ? initialAnswer
                : undefined
            }
            locked={locked}
            onProgress={(answer) => onProgress(answer)}
            onSubmit={(answer) => onSubmit(answer)}
            variant="flash-pop"
          />
        </div>
      );
    case "matching": {
      const matchingAnswer: MatchingAnswer | undefined = isMatchingAnswer(initialAnswer ?? null)
        ? (initialAnswer as MatchingAnswer)
        : undefined;
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <MatchingQuestion
            leftItems={question.leftItems}
            rightItems={question.rightItems}
            initialAnswer={matchingAnswer}
            locked={locked}
            onProgress={(answer) => onProgress(answer)}
            onIncorrectAttempt={onIncorrectAttempt}
            onSubmit={(answer) => onSubmit(answer)}
            variant="flash-pop"
          />
        </div>
      );
    }
    case "progressive-clues":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
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
          />
        </div>
      );
    case "progressive-image":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <ProgressiveImageQuestion
            key={question.id}
            surface={question.surface}
            revealDuration={question.revealDuration}
            answerLabel={question.answerLabel}
            answerPlaceholder={question.answerPlaceholder}
            locked={locked}
            onSubmit={onSubmit}
            onTimedResponseStart={onTimedResponseStart}
            variant="flash-pop"
          />
        </div>
      );
    case "heat-map":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <HeatMapQuestion
            question={question}
            locked={locked}
            onSubmit={onSubmit}
            variant="flash-pop"
          />
        </div>
      );
    case "estimation":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <EstimationQuestion
            min={question.min}
            max={question.max}
            step={question.step}
            initialValue={question.initialValue}
            unit={question.unit}
            locked={locked}
            onSubmit={onSubmit}
            variant="flash-pop"
          />
        </div>
      );
    case "classification": {
      const classificationAnswer: ClassificationAnswer | undefined = isClassificationAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as ClassificationAnswer)
        : undefined;
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <ClassificationQuestion
            items={question.items}
            categories={question.categories}
            initialAnswer={classificationAnswer}
            locked={locked}
            onProgress={onProgress}
            onSubmit={onSubmit}
            variant="flash-pop"
          />
        </div>
      );
    }
    case "anagram":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.themeAwareFormat}`}
          data-format={question.type}
        >
          <AnagramQuestion
            tiles={question.tiles}
            hint={question.hint}
            locked={locked}
            onSubmit={onSubmit}
            variant="flash-pop"
          />
        </div>
      );
    case "mini-wordle": {
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
          <MiniWordleQuestion
            correctAnswer={question.correctAnswer}
            additionalGuesses={question.additionalGuesses}
            hint={question.hint}
            wordLength={question.wordLength}
            maxAttempts={question.maxAttempts}
            initialAnswer={
              isMiniWordleAnswer(initialAnswer ?? null)
                ? (initialAnswer as MiniWordleAnswer)
                : undefined
            }
            locked={locked}
            onProgress={(answer) => onProgress(answer)}
            onSubmit={(answer) => onSubmit(answer)}
            onTimedResponseStart={onTimedResponseStart}
          />
        </div>
      );
    }
    case "word-search": {
      const wordSearchAnswer: WordSearchAnswer | undefined = isWordSearchAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as WordSearchAnswer)
        : undefined;
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
          <WordSearchQuestion
            question={question}
            initialAnswer={wordSearchAnswer}
            locked={locked}
            onProgress={(answer) => onProgress(answer)}
            onIncorrectAttempt={onIncorrectAttempt}
            onSubmit={(answer) => onSubmit(answer)}
          />
        </div>
      );
    }
    case "word-hashtag": {
      const wordHashtagAnswer: WordHashtagAnswer | undefined = isWordHashtagAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as WordHashtagAnswer)
        : undefined;
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
          <WordHashtagQuestion
            question={question}
            initialAnswer={wordHashtagAnswer}
            locked={locked}
            onProgress={(answer) => onProgress(answer)}
            onSubmit={(answer) => onSubmit(answer)}
          />
        </div>
      );
    }
    case "logic-matrix":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
          <LogicMatrixQuestion
            pieces={question.pieces}
            cells={question.cells}
            optionIds={question.optionIds}
            showPieceLabels={question.showPieceLabels}
            locked={locked}
            onSubmit={onSubmit}
            variant="flash-pop"
          />
        </div>
      );
    case "connect-pairs": {
      const connectAnswer: ConnectPairsAnswer | undefined = isConnectPairsAnswer(
        initialAnswer ?? null,
      )
        ? (initialAnswer as ConnectPairsAnswer)
        : undefined;
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
          <ConnectPairsQuestion
            question={question}
            initialAnswer={connectAnswer}
            locked={locked}
            onProgress={(answer) => onProgress(answer)}
            onSubmit={(answer) => onSubmit(answer)}
            variant="flash-pop"
          />
        </div>
      );
    }
    case "logic-code":
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
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
        </div>
      );
    case "queens": {
      const queensAnswer: Partial<QueensAnswer> | undefined = isQueensAnswer(initialAnswer ?? null)
        ? (initialAnswer as QueensAnswer)
        : undefined;
      return (
        <div
          className={`${styles.flashPopFormat} ${styles.legacyCompatFormat}`}
          data-format={question.type}
        >
          <QueensQuestion
            question={question}
            initialAnswer={queensAnswer}
            locked={locked}
            onProgress={(answer) => onProgress(answer)}
            onIncorrectAttempt={onIncorrectAttempt}
            onSubmit={(answer) => onSubmit(answer)}
            variant="flash-pop"
          />
        </div>
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
