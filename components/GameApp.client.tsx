"use client";

import { AnimatePresence, MotionConfig } from "motion/react";
import { QuestionScreen } from "@/components/QuestionScreen";
import { QuestionTransition } from "@/components/QuestionTransition";
import { ResultScreen } from "@/components/ResultScreen";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { SpeedBackground } from "@/components/SpeedBackground";
import { StageIntro } from "@/components/StageIntro";
import { useGameSession } from "@/features/game/useGameSession";
import type { Stage } from "@/types/game";

export function GameApp({ stage }: { stage: Stage }) {
  const session = useGameSession(stage);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white selection:bg-[var(--electric)] selection:text-black">
        <SpeedBackground />
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {session.phase === "intro" && (
              <StageIntro key={`intro-${stage.id}`} stage={stage} onStart={session.start} />
            )}
            {session.phase === "playing" && session.question && (
              <QuestionScreen
                key={session.question.id}
                question={session.question}
                stageTitle={stage.title}
                questionNumber={session.questionIndex + 1}
                totalQuestions={stage.questions.length}
                locked={session.locked}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
                codeAttemptCount={session.codeAttempts.length}
                onCodeAttempt={session.handleCodeAttempt}
                onProgress={session.handleAnswerProgress}
                onMatchingIncorrectAttempt={session.handleMatchingIncorrectAttempt}
              />
            )}
            {session.phase === "transition" && (
              <QuestionTransition
                key={`transition-${session.questionIndex}`}
                timedOut={session.lastTimedOut}
                isLast={session.questionIndex === stage.questions.length - 1}
              />
            )}
            {session.phase === "results" && (
              <ResultScreen
                key="results"
                stage={stage}
                results={session.results}
                score={session.score}
                onReview={session.showReview}
                onReplay={session.replay}
              />
            )}
            {session.phase === "review" && (
              <ReviewAnswers
                key="review"
                stage={stage}
                results={session.results}
                onBack={session.showResults}
                onReplay={session.replay}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </MotionConfig>
  );
}
