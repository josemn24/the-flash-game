"use client";

import { motion } from "motion/react";
import { CheckIcon, ChevronIcon, ClockIcon, CrossIcon, RotateIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import type { AnswerResult, AnswerValue, Stage } from "@/types/game";

function answerLabel(value: AnswerValue | null) {
  if (value === null) return "Sin respuesta";
  if (typeof value === "boolean") return value ? "Verdadero" : "Falso";
  return value;
}

function statusLabel(result: AnswerResult) {
  if (result.status === "correct") return "Correcta";
  if (result.status === "incorrect") return "Incorrecta";
  return "Sin contestar";
}

export function ReviewAnswers({ stage, results, onBack, onReplay }: {
  stage: Stage;
  results: AnswerResult[];
  onBack: () => void;
  onReplay: () => void;
}) {
  return (
    <motion.section className="mx-auto min-h-[100dvh] w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <header className="mb-9 flex items-center justify-between">
        <Logo />
        <button type="button" className="text-button" onClick={onBack}>Volver al resultado</button>
      </header>

      <div className="mb-7 sm:mb-9">
        <p className="eyebrow text-[var(--electric)]">Análisis de carrera</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">Revisa tus respuestas</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">Aquí sí: descubre qué acertaste, dónde fallaste y cuánto sumó cada decisión.</p>
      </div>

      <div className="space-y-3">
        {stage.questions.map((question, index) => {
          const result = results.find((item) => item.questionId === question.id);
          if (!result) return null;
          const correct = result.status === "correct";
          const unanswered = result.status === "unanswered";

          return (
            <motion.details key={question.id} className={`review-card ${correct ? "review-correct" : unanswered ? "review-unanswered" : "review-wrong"}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.3) }}>
              <summary>
                <span className="review-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 block font-mono text-[9px] font-black tracking-[0.15em] text-white/35 uppercase">{question.category}</span>
                  <span className="block text-sm font-bold leading-5 text-white sm:text-base">{question.question}</span>
                </span>
                <span className={`review-status ${correct ? "status-correct" : unanswered ? "status-unanswered" : "status-wrong"}`}>
                  {correct ? <CheckIcon className="h-4 w-4" /> : unanswered ? <ClockIcon className="h-4 w-4" /> : <CrossIcon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{statusLabel(result)}</span>
                </span>
                <ChevronIcon className="review-chevron h-5 w-5 text-white/25" />
              </summary>

              <div className="review-content">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="answer-box"><span>Tu respuesta</span><strong>{answerLabel(result.answer)}</strong></div>
                  <div className="answer-box answer-box-correct"><span>Respuesta correcta</span><strong>{answerLabel(question.correctAnswer)}</strong></div>
                </div>
                <div className="mt-3 rounded-xl bg-white/[0.035] p-4"><p className="text-sm leading-6 text-white/55">{question.explanation}</p></div>
                <div className="mt-3 flex items-center gap-4 font-mono text-[10px] font-bold tracking-wide uppercase">
                  <span className="text-white/35">Tiempo: {result.timeUsed.toFixed(1)} s</span>
                  <span className={result.points > 0 ? "text-[var(--electric)]" : result.points < 0 ? "text-[var(--coral)]" : "text-white/35"}>
                    {result.points > 0 ? "+" : ""}{result.points} pts
                  </span>
                </div>
              </div>
            </motion.details>
          );
        })}
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button type="button" className="secondary-button" onClick={onBack}>Volver al resultado</button>
        <button type="button" className="primary-button" onClick={onReplay}><RotateIcon className="h-5 w-5" />Volver a jugar</button>
      </div>
    </motion.section>
  );
}
