"use client";

import { motion } from "motion/react";
import type { ComponentType, FormEvent } from "react";
import { useState } from "react";
import { AnswerOption } from "@/components/AnswerOption";
import { ClassificationQuestion } from "@/components/ClassificationQuestion";
import { EstimationQuestion } from "@/components/EstimationQuestion";
import { ArrowIcon, CheckIcon, CrossIcon } from "@/components/icons";
import { LogicCodeQuestion } from "@/components/LogicCodeQuestion";
import { OrderingQuestion } from "@/components/OrderingQuestion";
import { OddOneOutQuestion } from "@/components/OddOneOutQuestion";
import styles from "@/components/QuestionScreen.module.css";
import type { AnswerValue, Question, QuestionOfType, QuestionType } from "@/types/game";

type CommonProps = {
  locked: boolean;
  onSubmit: (answer: AnswerValue) => void;
  codeAttemptCount: number;
  onCodeAttempt: (code: string) => boolean;
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

export const QUESTION_INPUT_RENDERERS = {
  "multiple-choice": MultipleChoiceInput,
  "odd-one-out": OddOneOutInput,
  "true-false": TrueFalseInput,
  "short-text": ShortTextInput,
  ordering: OrderingInput,
  classification: ClassificationInput,
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
