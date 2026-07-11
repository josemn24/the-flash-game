"use client";

import { motion } from "motion/react";
import { FormEvent, useState } from "react";
import { AnswerOption } from "@/components/AnswerOption";
import { ClassificationQuestion } from "@/components/ClassificationQuestion";
import { LogicCodeQuestion } from "@/components/LogicCodeQuestion";
import { ArrowIcon, BoltIcon, CheckIcon, CrossIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionMedia } from "@/components/QuestionMedia";
import { OrderingQuestion } from "@/components/OrderingQuestion";
import { Timer } from "@/components/Timer";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type { AnswerValue, Question } from "@/types/game";

type QuestionScreenProps = {
  question: Question;
  stageTitle: string;
  questionNumber: number;
  totalQuestions: number;
  locked: boolean;
  onSubmit: (answer: AnswerValue) => void;
  onTimeUp: () => void;
  codeAttemptCount: number;
  onCodeAttempt: (code: string) => boolean;
};

export function QuestionScreen({
  question,
  stageTitle,
  questionNumber,
  totalQuestions,
  locked,
  onSubmit,
  onTimeUp,
  codeAttemptCount,
  onCodeAttempt,
}: QuestionScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const isChoice =
    question.type === "multiple-choice" || question.type === "image-choice";

  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = textAnswer.trim();
    if (value && !locked) onSubmit(value);
  };

  return (
    <motion.section
      className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6"
      initial={{ opacity: 0, x: 34 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -34 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <AppHeader
        className="mb-5 gap-4 sm:mb-7"
        left={(
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="brand-mark brand-mark-small">
                <BoltIcon className="h-3.5 w-3.5" />
              </span>
              <p className="eyebrow text-white/55">{stageTitle}</p>
            </div>
            <p className="font-mono text-sm font-bold tracking-wide text-white">
              Pregunta {questionNumber}
              <span className="text-white/35"> / {totalQuestions}</span>
            </p>
          </div>
        )}
        right={<Timer duration={question.timeLimit} active={!locked} onTimeUp={onTimeUp} />}
      />

      <ProgressBar current={questionNumber} total={totalQuestions} />

      <div className="flex flex-1 flex-col pt-6 sm:pt-9">
        <div className="mb-4 flex items-center justify-between">
          <Badge>{question.category}</Badge>
          <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-white/35 uppercase">
            {QUESTION_FORMAT_LABELS[question.type]}
          </span>
        </div>

        <h1 className={`question-title ${question.type === "ordering" || question.type === "logic-code" ? "question-title-ordering" : ""}`}>
          {question.question}
        </h1>

        {question.media && (
          <div className="mt-5 sm:mt-6">
            <QuestionMedia media={question.media} />
          </div>
        )}

        {isChoice && question.options && (
          <div className="mt-7 grid gap-2.5 sm:mt-8 sm:grid-cols-2 sm:gap-3">
            {question.options.map((option, index) => (
              <AnswerOption
                key={option}
                label={option}
                index={index}
                selected={selected === option}
                disabled={locked}
                onSelect={() => setSelected(option)}
              />
            ))}
          </div>
        )}

        {question.type === "true-false" && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4">
            <motion.button
              type="button"
              className="truth-button truth-button-true"
              disabled={locked}
              onClick={() => onSubmit(true)}
              whileTap={{ scale: 0.97 }}
            >
              <CheckIcon className="h-7 w-7" />
              <span>Verdadero</span>
            </motion.button>
            <motion.button
              type="button"
              className="truth-button truth-button-false"
              disabled={locked}
              onClick={() => onSubmit(false)}
              whileTap={{ scale: 0.97 }}
            >
              <CrossIcon className="h-7 w-7" />
              <span>Falso</span>
            </motion.button>
          </div>
        )}

        {question.type === "short-text" && (
          <form className="mt-8" onSubmit={submitText}>
            <label className="mb-2.5 block text-sm font-bold text-white/65" htmlFor={`answer-${question.id}`}>
              Escribe tu respuesta
            </label>
            <div className="text-answer-row">
              <input
                id={`answer-${question.id}`}
                className="text-answer-input"
                type="text"
                value={textAnswer}
                onChange={(event) => setTextAnswer(event.target.value)}
                placeholder="Tu respuesta…"
                disabled={locked}
                autoComplete="off"
                autoFocus
              />
              <motion.button
                className="text-submit-button"
                type="submit"
                disabled={locked || !textAnswer.trim()}
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
        )}

        {question.type === "ordering" && (
          <OrderingQuestion
            items={question.items}
            locked={locked}
            onSubmit={onSubmit}
          />
        )}

        {question.type === "classification" && (
          <ClassificationQuestion
            items={question.items}
            categories={question.categories}
            locked={locked}
            onSubmit={onSubmit}
          />
        )}

        {question.type === "logic-code" && (
          <LogicCodeQuestion
            clues={question.clues}
            codeLength={question.codeLength}
            locked={locked}
            attemptCount={codeAttemptCount}
            onAttempt={onCodeAttempt}
          />
        )}

        {isChoice && (
          <Button
            className="mt-auto sm:mt-8"
            disabled={!selected || locked}
            onClick={() => selected && onSubmit(selected)}
            whileTap={{ scale: 0.985 }}
          >
            Confirmar respuesta
            <ArrowIcon className="h-5 w-5" />
          </Button>
        )}
      </div>
    </motion.section>
  );
}
