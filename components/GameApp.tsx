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
import { stages } from "@/data/stages";
import { calculateAnswerScore, calculateTotalScore, isAnswerCorrect } from "@/lib/scoring";
import type { AnswerResult, AnswerValue, GameScreen, Stage } from "@/types/game";

const TRANSITION_DURATION = 650;

export function GameApp() {
  const [screen, setScreen] = useState<GameScreen>("start");
  const [selectedStage, setSelectedStage] = useState<Stage>(stages[0]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [locked, setLocked] = useState(false);
  const [lastTimedOut, setLastTimedOut] = useState(false);
  const [codeAttempts, setCodeAttempts] = useState<string[]>([]);
  const questionStartedAt = useRef(0);
  const answerLock = useRef(false);
  const codeAttemptsRef = useRef<string[]>([]);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = selectedStage.questions[questionIndex];
  const score = useMemo(
    () => calculateTotalScore(results.map((result) => result.points)),
    [results],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, questionIndex]);

  const beginStage = () => {
    setQuestionIndex(0);
    setResults([]);
    setLocked(false);
    setCodeAttempts([]);
    codeAttemptsRef.current = [];
    answerLock.current = false;
    questionStartedAt.current = performance.now();
    setScreen("playing");
  };

  const selectStage = (stage: Stage) => {
    setSelectedStage(stage);
    setScreen("intro");
  };

  const replay = () => {
    if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
    setResults([]);
    setQuestionIndex(0);
    setLocked(false);
    setCodeAttempts([]);
    codeAttemptsRef.current = [];
    answerLock.current = false;
    setScreen("intro");
  };

  const submitAnswer = useCallback(
    (answer: AnswerValue | null, timedOut = false, submittedCodes?: string[]) => {
      if (answerLock.current || !question) return;
      answerLock.current = true;
      setLocked(true);

      const rawTime = timedOut
        ? question.timeLimit
        : (performance.now() - questionStartedAt.current) / 1000;
      const timeUsed = Math.min(Math.max(rawTime, 0), question.timeLimit);
      const isCorrect = answer !== null && isAnswerCorrect(question, answer);
      const incorrectAttempts =
        question.type === "logic-code"
          ? Math.max(0, (submittedCodes?.length ?? 0) - (isCorrect ? 1 : 0))
          : undefined;
      const points =
        answer === null || timedOut
          ? 0
          : calculateAnswerScore(question, answer, timeUsed, incorrectAttempts);

      setResults((current) => [
        ...current,
        {
          questionId: question.id,
          answer,
          isCorrect,
          status: answer === null ? "unanswered" : isCorrect ? "correct" : "incorrect",
          points,
          timeUsed,
          ...(question.type === "logic-code"
            ? { submittedCodes: submittedCodes ?? [], incorrectAttempts }
            : {}),
        },
      ]);
      setLastTimedOut(timedOut);
      setScreen("transition");

      const lastQuestion = questionIndex === selectedStage.questions.length - 1;
      advanceTimeout.current = setTimeout(() => {
        if (lastQuestion) {
          setScreen("results");
          return;
        }

        setQuestionIndex((current) => current + 1);
        answerLock.current = false;
        setLocked(false);
        setCodeAttempts([]);
        codeAttemptsRef.current = [];
        questionStartedAt.current = performance.now();
        setScreen("playing");
      }, TRANSITION_DURATION);
    },
    [question, questionIndex, selectedStage.questions.length],
  );

  const handleCodeAttempt = useCallback(
    (code: string) => {
      if (answerLock.current || question?.type !== "logic-code") return false;
      const nextAttempts = [...codeAttemptsRef.current, code];
      codeAttemptsRef.current = nextAttempts;
      setCodeAttempts(nextAttempts);

      const correct = isAnswerCorrect(question, code);
      if (correct) submitAnswer(code, false, nextAttempts);
      return correct;
    },
    [question, submitAnswer],
  );

  const handleTimeUp = useCallback(() => {
    if (question?.type === "logic-code") {
      const attempts = codeAttemptsRef.current;
      submitAnswer(attempts.at(-1) ?? null, true, attempts);
      return;
    }
    submitAnswer(null, true);
  }, [question, submitAnswer]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white selection:bg-[var(--electric)] selection:text-black">
      <SpeedBackground />
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {screen === "start" && (
            <StartScreen key="start" stages={stages} onSelectStage={selectStage} />
          )}
          {screen === "intro" && (
            <StageIntro
              key={`intro-${selectedStage.id}`}
              stage={selectedStage}
              onStart={beginStage}
            />
          )}
          {screen === "playing" && question && (
            <QuestionScreen
              key={question.id}
              question={question}
              stageTitle={selectedStage.title}
              questionNumber={questionIndex + 1}
              totalQuestions={selectedStage.questions.length}
              locked={locked}
              onSubmit={(answer) => submitAnswer(answer)}
              onTimeUp={handleTimeUp}
              codeAttemptCount={codeAttempts.length}
              onCodeAttempt={handleCodeAttempt}
            />
          )}
          {screen === "transition" && (
            <QuestionTransition
              key={`transition-${questionIndex}`}
              timedOut={lastTimedOut}
              isLast={questionIndex === selectedStage.questions.length - 1}
            />
          )}
          {screen === "results" && (
            <ResultScreen
              key="results"
              stage={selectedStage}
              results={results}
              score={score}
              onReview={() => setScreen("review")}
              onReplay={replay}
            />
          )}
          {screen === "review" && (
            <ReviewAnswers
              key="review"
              stage={selectedStage}
              results={results}
              onBack={() => setScreen("results")}
              onReplay={replay}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
