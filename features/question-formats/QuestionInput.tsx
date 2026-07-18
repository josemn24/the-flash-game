"use client";

import { motion } from "motion/react";
import type { ComponentType, FormEvent } from "react";
import { useState } from "react";
import { AnswerOption } from "@/components/AnswerOption";
import { AnagramQuestion } from "@/components/AnagramQuestion";
import { ClassificationQuestion } from "@/components/ClassificationQuestion";
import { EstimationQuestion } from "@/components/EstimationQuestion";
import { ErrorReconstructionQuestionInput } from "@/components/ErrorReconstructionQuestion";
import { FlashMemoryQuestion } from "@/components/FlashMemoryQuestion";
import { HeatMapQuestion } from "@/components/HeatMapQuestion";
import { ImageLabelingQuestion } from "@/components/ImageLabelingQuestion";
import { ArrowIcon, CheckIcon, CrossIcon } from "@/components/icons";
import { LogicCodeQuestion } from "@/components/LogicCodeQuestion";
import { LogicMatrixQuestion } from "@/components/LogicMatrixQuestion";
import { MatchingQuestion } from "@/components/MatchingQuestion";
import { MiniNonogramQuestion } from "@/components/MiniNonogramQuestion";
import { MiniSudokuQuestion } from "@/components/MiniSudokuQuestion";
import { MiniWordleQuestion } from "@/components/MiniWordleQuestion";
import { OrderingQuestion } from "@/components/OrderingQuestion";
import { OddOneOutQuestion } from "@/components/OddOneOutQuestion";
import { ProgressiveCluesQuestion } from "@/components/ProgressiveCluesQuestion";
import { ProgressiveImageQuestion } from "@/components/ProgressiveImageQuestion";
import { SimonSequenceQuestion } from "@/components/SimonSequenceQuestion";
import { SlidingPuzzleQuestion } from "@/components/SlidingPuzzleQuestion";
import styles from "@/components/QuestionScreen.module.css";
import type { AnswerValue, Question, QuestionOfType, QuestionType } from "@/types/game";

type CommonProps = {
  locked: boolean;
  onSubmit: (answer: AnswerValue) => void;
  codeAttemptCount: number;
  onCodeAttempt: (code: string) => boolean;
  onProgress: (answer: AnswerValue) => void;
  onMatchingIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onTimedResponseStart: () => void;
};

type QuestionInputProps<T extends Question = Question> = CommonProps & { question: T };

function MultipleChoiceInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"multiple-choice">>) {
  return (
    <div className="mt-7 grid gap-2.5 sm:mt-8 sm:grid-cols-2 sm:gap-3">
      {question.options.map((option, index) => (
        <AnswerOption
          key={option}
          label={option}
          index={index}
          disabled={locked}
          onSelect={() => onSubmit(option)}
        />
      ))}
    </div>
  );
}

function TrueFalseInput({ locked, onSubmit }: QuestionInputProps<QuestionOfType<"true-false">>) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4">
      <motion.button
        type="button"
        className={`${styles.truthButton} ${styles.truthButtonTrue}`}
        disabled={locked}
        onClick={() => onSubmit(true)}
        whileTap={{ scale: 0.97 }}
      >
        <CheckIcon className="h-7 w-7" />
        <span>Verdadero</span>
      </motion.button>
      <motion.button
        type="button"
        className={`${styles.truthButton} ${styles.truthButtonFalse}`}
        disabled={locked}
        onClick={() => onSubmit(false)}
        whileTap={{ scale: 0.97 }}
      >
        <CrossIcon className="h-7 w-7" />
        <span>Falso</span>
      </motion.button>
    </div>
  );
}

function OddOneOutInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"odd-one-out">>) {
  return <OddOneOutQuestion items={question.items} locked={locked} onSubmit={onSubmit} />;
}

function MatchingInput({
  question,
  locked,
  onProgress,
  onMatchingIncorrectAttempt,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"matching">>) {
  return (
    <MatchingQuestion
      leftItems={question.leftItems}
      rightItems={question.rightItems}
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onMatchingIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}

function ShortTextInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"short-text">>) {
  const [answer, setAnswer] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = answer.trim();
    if (value && !locked) onSubmit(value);
  };

  return (
    <form className="mt-8" onSubmit={submit}>
      <label
        className="mb-2.5 block text-sm font-bold text-white/65"
        htmlFor={`answer-${question.id}`}
      >
        Escribe tu respuesta
      </label>
      <div className={styles.textAnswerRow}>
        <input
          id={`answer-${question.id}`}
          className={styles.textAnswerInput}
          type="text"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Tu respuesta…"
          disabled={locked}
          autoComplete="off"
          autoFocus
        />
        <motion.button
          className={styles.textSubmitButton}
          type="submit"
          disabled={locked || !answer.trim()}
          whileTap={{ scale: 0.96 }}
          aria-label="Enviar respuesta"
        >
          <ArrowIcon className="h-6 w-6" />
        </motion.button>
      </div>
      <p className="mt-3 text-xs leading-5 text-white/35">
        No importan las mayúsculas, las tildes ni los espacios.
      </p>
    </form>
  );
}

function OrderingInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"ordering">>) {
  return <OrderingQuestion items={question.items} locked={locked} onSubmit={onSubmit} />;
}

function ProgressiveCluesInput({
  question,
  locked,
  onProgressiveClueReveal,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"progressive-clues">>) {
  return (
    <ProgressiveCluesQuestion
      questionId={question.id}
      clues={question.clues}
      cluePenalty={question.cluePenalty}
      points={question.points}
      locked={locked}
      onReveal={onProgressiveClueReveal}
      onSubmit={onSubmit}
    />
  );
}

function ProgressiveImageInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<QuestionOfType<"progressive-image">>) {
  return (
    <ProgressiveImageQuestion
      key={question.id}
      surface={question.surface}
      revealDuration={question.revealDuration}
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
}: QuestionInputProps<QuestionOfType<"heat-map">>) {
  return <HeatMapQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}

function ImageLabelingInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"image-labeling">>) {
  return <ImageLabelingQuestion question={question} locked={locked} onSubmit={onSubmit} />;
}

function ClassificationInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"classification">>) {
  return (
    <ClassificationQuestion
      items={question.items}
      categories={question.categories}
      locked={locked}
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
}: QuestionInputProps<QuestionOfType<"flash-memory">>) {
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

function SimonSequenceInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<QuestionOfType<"simon-sequence">>) {
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
}: QuestionInputProps<QuestionOfType<"logic-matrix">>) {
  return (
    <LogicMatrixQuestion
      pieces={question.pieces}
      cells={question.cells}
      optionIds={question.optionIds}
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
}: QuestionInputProps<QuestionOfType<"mini-sudoku">>) {
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
}: QuestionInputProps<QuestionOfType<"mini-nonogram">>) {
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

function SlidingPuzzleInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"sliding-puzzle">>) {
  return (
    <SlidingPuzzleQuestion
      initialTiles={question.initialTiles}
      solution={question.solution}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function LogicCodeInput({
  question,
  locked,
  codeAttemptCount,
  onCodeAttempt,
}: QuestionInputProps<QuestionOfType<"logic-code">>) {
  return (
    <LogicCodeQuestion
      clues={question.clues}
      codeLength={question.codeLength}
      locked={locked}
      attemptCount={codeAttemptCount}
      onAttempt={onCodeAttempt}
    />
  );
}

function EstimationInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"estimation">>) {
  return (
    <EstimationQuestion
      min={question.min}
      max={question.max}
      step={question.step}
      initialValue={question.initialValue}
      unit={question.unit}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function ErrorReconstructionInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<QuestionOfType<"error-reconstruction">>) {
  return (
    <ErrorReconstructionQuestionInput
      question={question}
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
}: QuestionInputProps<QuestionOfType<"anagram">>) {
  return (
    <AnagramQuestion
      tiles={question.tiles}
      hint={question.hint}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function MiniWordleInput({
  question,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<QuestionOfType<"mini-wordle">>) {
  return (
    <MiniWordleQuestion
      correctAnswer={question.correctAnswer}
      additionalGuesses={question.additionalGuesses}
      hint={question.hint}
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
  "true-false": TrueFalseInput,
  "short-text": ShortTextInput,
  "progressive-clues": ProgressiveCluesInput,
  "progressive-image": ProgressiveImageInput,
  "heat-map": HeatMapInput,
  "image-labeling": ImageLabelingInput,
  ordering: OrderingInput,
  classification: ClassificationInput,
  "flash-memory": FlashMemoryInput,
  "simon-sequence": SimonSequenceInput,
  "logic-matrix": LogicMatrixInput,
  "mini-sudoku": MiniSudokuInput,
  "mini-nonogram": MiniNonogramInput,
  "sliding-puzzle": SlidingPuzzleInput,
  "error-reconstruction": ErrorReconstructionInput,
  anagram: AnagramInput,
  "mini-wordle": MiniWordleInput,
  "logic-code": LogicCodeInput,
  estimation: EstimationInput,
} satisfies {
  [T in QuestionType]: ComponentType<QuestionInputProps<QuestionOfType<T>>>;
};

export function QuestionInput(props: QuestionInputProps) {
  const Renderer = QUESTION_INPUT_RENDERERS[
    props.question.type
  ] as ComponentType<QuestionInputProps>;
  return <Renderer {...props} />;
}
