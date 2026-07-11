"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionScreen } from "@/components/QuestionScreen";
import { QuestionTransition } from "@/components/QuestionTransition";
import { ResultScreen } from "@/components/ResultScreen";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { SpeedBackground } from "@/components/SpeedBackground";
import { StageIntro } from "@/components/StageIntro";
import { StartScreen } from "@/components/StartScreen";
import { demoStage } from "@/data/demoStage";
import { calculateQuestionScore, calculateTotalScore, isAnswerCorrect } from "@/lib/scoring";
import type { AnswerResult, AnswerValue, GameScreen } from "@/types/game";

const TRANSITION_DURATION = 650;

export function GameApp() {
  const [screen, setScreen] = useState<GameScreen>("start");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [locked, setLocked] = useState(false);
  const [lastTimedOut, setLastTimedOut] = useState(false);
  const questionStartedAt = useRef(0);
  const answerLock = useRef(false);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = demoStage.questions[questionIndex];
  const score = useMemo(() => calculateTotalScore(results.map((result) => result.points)), [results]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, questionIndex]);

  const beginStage = () => {
    setQuestionIndex(0);
    setResults([]);
    setLocked(false);
    answerLock.current = false;
    questionStartedAt.current = performance.now();
    setScreen("playing");
  };

  const replay = () => {
    if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
    setResults([]);
    setQuestionIndex(0);
    setLocked(false);
    answerLock.current = false;
    setScreen("intro");
  };

  const submitAnswer = useCallback((answer: AnswerValue | null, timedOut = false) => {
    if (answerLock.current || !question) return;
    answerLock.current = true;
    setLocked(true);

    const rawTime = timedOut ? question.timeLimit : (performance.now() - questionStartedAt.current) / 1000;
    const timeUsed = Math.min(Math.max(rawTime, 0), question.timeLimit);
    const isCorrect = answer !== null && isAnswerCorrect(question, answer);
    const points = answer === null ? 0 : calculateQuestionScore(question, isCorrect, timeUsed);

    setResults((current) => [...current, {
      questionId: question.id,
      answer,
      isCorrect,
      status: answer === null ? "unanswered" : isCorrect ? "correct" : "incorrect",
      points,
      timeUsed,
    }]);
    setLastTimedOut(timedOut);
    setScreen("transition");

    const lastQuestion = questionIndex === demoStage.questions.length - 1;
    advanceTimeout.current = setTimeout(() => {
      if (lastQuestion) {
        setScreen("results");
        return;
      }

      setQuestionIndex((current) => current + 1);
      answerLock.current = false;
      setLocked(false);
      questionStartedAt.current = performance.now();
      setScreen("playing");
    }, TRANSITION_DURATION);
  }, [question, questionIndex]);

  const handleTimeUp = useCallback(() => submitAnswer(null, true), [submitAnswer]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white selection:bg-[var(--electric)] selection:text-black">
      <SpeedBackground />
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {screen === "start" && <StartScreen key="start" onPlay={() => setScreen("intro")} />}
          {screen === "intro" && <StageIntro key="intro" stage={demoStage} onStart={beginStage} />}
          {screen === "playing" && question && (
            <QuestionScreen
              key={question.id}
              question={question}
              questionNumber={questionIndex + 1}
              totalQuestions={demoStage.questions.length}
              locked={locked}
              onSubmit={(answer) => submitAnswer(answer)}
              onTimeUp={handleTimeUp}
            />
          )}
          {screen === "transition" && (
            <QuestionTransition key={`transition-${questionIndex}`} timedOut={lastTimedOut} isLast={questionIndex === demoStage.questions.length - 1} />
          )}
          {screen === "results" && (
            <ResultScreen key="results" stage={demoStage} results={results} score={score} onReview={() => setScreen("review")} onReplay={replay} />
          )}
          {screen === "review" && (
            <ReviewAnswers key="review" stage={demoStage} results={results} onBack={() => setScreen("results")} onReplay={replay} />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
