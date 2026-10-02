"use client";

import {
  AnagramQuestion,
  AnswerOption,
  ClassificationQuestion,
  ConnectPairsQuestion,
  ErrorReconstructionQuestionInput,
  EscapeQuestion,
  EstimationQuestion,
  FlashMemoryQuestion,
  HeatMapQuestion,
  ImageLabelingQuestion,
  LogicCodeQuestion,
  LogicMatrixQuestion,
  MatchingQuestion,
  MemoryPairsQuestion,
  MiniNonogramQuestion,
  MiniSudokuQuestion,
  MiniWordleQuestion,
  NumberSequencePrompt,
  OddOneOutQuestion,
  OrderingQuestion,
  PipesQuestion,
  ProgressiveCluesQuestion,
  ProgressiveImageQuestion,
  QueensQuestion,
  ServerOperationStatus,
  SimonSequenceQuestion,
  SlidingPuzzleQuestion,
  TimeMazeQuestion,
  TrueFalseQuestion,
  WordHashtagQuestion,
  WordSearchQuestion,
  ZipQuestion,
} from "@/components/questions";
import { isQueensAnswer } from "@/lib/queens";
import {
  isClassificationAnswer,
  isConnectPairsAnswer,
  isErrorReconstructionAnswer,
  isMatchingAnswer,
  isMiniWordleAnswer,
  isWordHashtagAnswer,
  isWordSearchAnswer,
} from "@/lib/scoring";
import type {
  ClassificationAnswer,
  PracticeAnswerValueOfType,
  PracticeQuestion,
  PracticeQuestionOfType,
  PracticeQuestionType,
} from "@/types/gameplay/practice";
import type { ComponentType } from "react";
import { useState } from "react";
import { ShortTextInput } from "./formats/short-text/ShortTextInput";
import styles from "./QuestionInput.module.css";

type CommonProps<T extends PracticeQuestionType> = {
  locked: boolean;
  onSubmit: (answer: PracticeAnswerValueOfType<T>) => void;
  pendingAnswer?: PracticeAnswerValueOfType<T> | null;
  submissionState?: "idle" | "submitting" | "error";
  submissionStatusVisible?: boolean;
  submissionError?: string;
  onRetrySubmission?: () => void;
  codeAttemptCount?: number;
  onCodeAttempt: (code: string) => boolean;
  onProgress: (answer: PracticeAnswerValueOfType<T>) => void;
  onIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onTimedResponseStart: () => void;
  initialAnswer?: PracticeAnswerValueOfType<T> | null;
  progressiveCluesRevealed?: number;
};

type QuestionInputProps<T extends PracticeQuestion = PracticeQuestion> = CommonProps<T["type"]> & {
  question: T;
};

function MultipleChoiceInput({
  question,
  locked,
  onSubmit,
  pendingAnswer,
  submissionState,
  submissionStatusVisible = false,
  submissionError,
  onRetrySubmission,
}: QuestionInputProps<PracticeQuestionOfType<"multiple-choice">>) {
  const selectedAnswer = typeof pendingAnswer === "string" ? pendingAnswer : null;
  const resolvedSubmissionState = submissionState ?? "idle";
  const submissionFeedbackEnabled = submissionState !== undefined;

  return (
    <>
      {question.promptVisual?.type === "number-sequence" && (
        <NumberSequencePrompt prompt={question.promptVisual} />
      )}
      <div
        className={`${question.promptVisual ? "mt-4" : "mt-7 sm:mt-8"} grid gap-2.5 sm:grid-cols-2 sm:gap-3`}
      >
        {question.options.map((option, index) => (
          <AnswerOption
            key={option}
            label={option}
            index={index}
            selected={selectedAnswer === option}
            pending={selectedAnswer === option}
            disabled={locked}
            onSelect={() => onSubmit(option)}
          />
        ))}
      </div>
      {submissionFeedbackEnabled ? (
        <ServerOperationStatus
          state={resolvedSubmissionState}
          visible={submissionStatusVisible}
          pendingMessage="Comprobando respuesta…"
          errorMessage={submissionError ?? "No hemos podido confirmar tu respuesta."}
          retryLabel="Reintentar"
          onRetry={onRetrySubmission}
        />
      ) : null}
    </>
  );
}

function TrueFalseInput({
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"true-false">>) {
  return <TrueFalseQuestion locked={locked} onSubmit={onSubmit} />;
}

function OddOneOutInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"odd-one-out">>) {
  return <OddOneOutQuestion items={question.items} locked={locked} onSubmit={onSubmit} />;
}

function MatchingInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"matching">>) {
  return (
    <MatchingQuestion
      leftItems={question.leftItems}
      rightItems={question.rightItems}
      initialAnswer={
        initialAnswer !== undefined && isMatchingAnswer(initialAnswer) ? initialAnswer : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}

function ConnectPairsInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"connect-pairs">>) {
  return (
    <ConnectPairsQuestion
      key={question.id}
      question={question}
      initialAnswer={
        initialAnswer !== undefined && isConnectPairsAnswer(initialAnswer)
          ? initialAnswer
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function OrderingInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"ordering">>) {
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
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function ProgressiveCluesInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onProgressiveClueReveal,
  onSubmit,
  progressiveCluesRevealed,
}: QuestionInputProps<PracticeQuestionOfType<"progressive-clues">>) {
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
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function ProgressiveImageInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"progressive-image">>) {
  return (
    <ProgressiveImageQuestion
      key={question.id}
      surface={question.surface}
      revealDuration={question.revealDuration}
      answerLabel={question.answerLabel}
      answerPlaceholder={question.answerPlaceholder}
      locked={locked}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}

function HeatMapInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"heat-map">>) {
  return <HeatMapQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}

function ImageLabelingInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"image-labeling">>) {
  return <ImageLabelingQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}

function ClassificationInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"classification">>) {
  return (
    <ClassificationQuestion
      items={question.items}
      categories={question.categories}
      initialAnswer={
        isClassificationAnswer(initialAnswer ?? null)
          ? (initialAnswer as ClassificationAnswer)
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function FlashMemoryInput({
  question,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"flash-memory">>) {
  return (
    <FlashMemoryQuestion
      items={question.items}
      grid={question.grid}
      revealDuration={question.revealDuration}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}

function MemoryPairsInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"memory-pairs">>) {
  return (
    <MemoryPairsQuestion
      grid={question.grid}
      tiles={question.tiles}
      mismatchRevealDuration={question.mismatchRevealDuration}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function SimonSequenceInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"simon-sequence">>) {
  return (
    <SimonSequenceQuestion
      pads={question.pads}
      sequence={question.sequence}
      locked={locked}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}

function LogicMatrixInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"logic-matrix">>) {
  return (
    <LogicMatrixQuestion
      pieces={question.pieces}
      cells={question.cells}
      optionIds={question.optionIds}
      showPieceLabels={question.showPieceLabels}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function MiniSudokuInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"mini-sudoku">>) {
  return (
    <MiniSudokuQuestion
      grid={question.grid}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function MiniNonogramInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"mini-nonogram">>) {
  return (
    <MiniNonogramQuestion
      rowClues={question.rowClues}
      columnClues={question.columnClues}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function QueensInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"queens">>) {
  return (
    <QueensQuestion
      key={question.id}
      question={question}
      initialAnswer={isQueensAnswer(initialAnswer, question.grid) ? initialAnswer : undefined}
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}

function SlidingPuzzleInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"sliding-puzzle">>) {
  return (
    <SlidingPuzzleQuestion
      initialTiles={question.initialTiles}
      solution={question.solution}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function EscapeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"escape">>) {
  return (
    <EscapeQuestion
      key={question.id}
      question={question}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function TimeMazeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"time-maze">>) {
  return (
    <TimeMazeQuestion
      key={question.id}
      question={question}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function ZipInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"zip">>) {
  return (
    <ZipQuestion
      key={question.id}
      question={question}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function PipesInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"pipes">>) {
  return (
    <PipesQuestion
      key={question.id}
      question={question}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function LogicCodeInput({
  question,
  locked,
  initialAnswer,
  codeAttemptCount = 0,
  onProgress,
  onCodeAttempt,
}: QuestionInputProps<PracticeQuestionOfType<"logic-code">>) {
  return (
    <LogicCodeQuestion
      clues={question.clues}
      codeLength={question.codeLength}
      initialDraft={typeof initialAnswer === "string" ? initialAnswer : undefined}
      locked={locked}
      attemptCount={codeAttemptCount}
      onProgress={onProgress}
      onAttempt={onCodeAttempt}
    />
  );
}

function EstimationInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"estimation">>) {
  return (
    <LocalEstimationInput
      key={question.id}
      question={question}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function LocalEstimationInput({
  question,
  locked,
  onSubmit,
}: Pick<
  QuestionInputProps<PracticeQuestionOfType<"estimation">>,
  "question" | "locked" | "onSubmit"
>) {
  const [value, setValue] = useState(question.initialValue);

  return (
    <EstimationQuestion
      min={question.min}
      max={question.max}
      step={question.step}
      value={value}
      unit={question.unit}
      locked={locked}
      onChange={setValue}
      onSubmit={onSubmit}
    />
  );
}

function ErrorReconstructionInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"error-reconstruction">>) {
  return (
    <ErrorReconstructionQuestionInput
      question={question}
      initialAnswer={
        initialAnswer !== undefined && isErrorReconstructionAnswer(initialAnswer)
          ? initialAnswer
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function AnagramInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"anagram">>) {
  return (
    <AnagramQuestion
      tiles={question.tiles}
      hint={question.hint}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function WordHashtagInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"word-hashtag">>) {
  return (
    <WordHashtagQuestion
      key={question.id}
      question={question}
      initialAnswer={isWordHashtagAnswer(initialAnswer) ? initialAnswer : undefined}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}

function WordSearchInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"word-search">>) {
  return (
    <WordSearchQuestion
      key={question.id}
      question={question}
      initialAnswer={
        initialAnswer !== undefined && isWordSearchAnswer(initialAnswer) ? initialAnswer : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}

function MiniWordleInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"mini-wordle">>) {
  return (
    <MiniWordleQuestion
      correctAnswer={question.correctAnswer}
      additionalGuesses={question.additionalGuesses}
      hint={question.hint}
      wordLength={question.wordLength}
      maxAttempts={question.maxAttempts}
      initialAnswer={
        initialAnswer !== undefined && isMiniWordleAnswer(initialAnswer) ? initialAnswer : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}

export const QUESTION_INPUT_RENDERERS = {
  "multiple-choice": MultipleChoiceInput,
  "odd-one-out": OddOneOutInput,
  matching: MatchingInput,
  "connect-pairs": ConnectPairsInput,
  "true-false": TrueFalseInput,
  "short-text": ShortTextInput,
  "progressive-clues": ProgressiveCluesInput,
  "progressive-image": ProgressiveImageInput,
  "heat-map": HeatMapInput,
  "image-labeling": ImageLabelingInput,
  ordering: OrderingInput,
  classification: ClassificationInput,
  "flash-memory": FlashMemoryInput,
  "memory-pairs": MemoryPairsInput,
  "simon-sequence": SimonSequenceInput,
  "logic-matrix": LogicMatrixInput,
  "mini-sudoku": MiniSudokuInput,
  "mini-nonogram": MiniNonogramInput,
  queens: QueensInput,
  "time-maze": TimeMazeInput,
  "sliding-puzzle": SlidingPuzzleInput,
  escape: EscapeInput,
  "error-reconstruction": ErrorReconstructionInput,
  anagram: AnagramInput,
  "word-hashtag": WordHashtagInput,
  "word-search": WordSearchInput,
  "mini-wordle": MiniWordleInput,
  "logic-code": LogicCodeInput,
  estimation: EstimationInput,
  zip: ZipInput,
  pipes: PipesInput,
} satisfies {
  [T in PracticeQuestionType]: ComponentType<QuestionInputProps<PracticeQuestionOfType<T>>>;
};

export function QuestionInput(props: QuestionInputProps) {
  const Renderer = QUESTION_INPUT_RENDERERS[
    props.question.type
  ] as ComponentType<QuestionInputProps>;
  return (
    <div
      className={styles.questionInput}
      data-format={props.question.type}
      aria-busy={props.submissionState === "submitting" || undefined}
    >
      <Renderer {...props} />
    </div>
  );
}
