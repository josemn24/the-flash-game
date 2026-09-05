"use client";

import { useMemo } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { QuestionScreen } from "@/components/game/shared/QuestionScreen";
import { QuestionTransition } from "@/components/game/shared/QuestionTransition";
import { ResultScreen } from "@/components/game/shared/ResultScreen";
import { ReviewAnswers } from "@/components/game/shared/ReviewAnswers";
import { SpeedBackground } from "@/components/effects/SpeedBackground";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { useGameSession } from "@/features/game/useGameSession";
import { withChallengeScoring } from "@/lib/challengeScoring";
import type { FlashChallenge } from "@/types/game";

export function FlashGameApp({ challenge }: { challenge: FlashChallenge }) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const session = useGameSession(scoredChallenge);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)] selection:bg-[var(--color-brand)] selection:text-[var(--color-text-on-brand)]">
        <SpeedBackground />
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {session.phase === "intro" && (
              <ChallengeIntro
                key={`intro-${challenge.id}`}
                challenge={scoredChallenge}
                onStart={session.start}
              />
            )}
            {session.phase === "playing" && session.question && (
              <QuestionScreen
                key={session.question.id}
                question={session.question}
                challengeTitle={scoredChallenge.title}
                questionNumber={session.questionIndex + 1}
                totalQuestions={scoredChallenge.questions.length}
                locked={session.locked}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
                codeAttemptCount={session.codeAttempts.length}
                onCodeAttempt={session.handleCodeAttempt}
                onProgress={session.handleAnswerProgress}
                onIncorrectAttempt={session.handleIncorrectAttempt}
                onProgressiveClueReveal={session.handleProgressiveClueReveal}
                onTimedResponseStart={session.handleTimedResponseStart}
              />
            )}
            {session.phase === "transition" && (
              <QuestionTransition
                key={`transition-${session.questionIndex}`}
                timedOut={session.lastTimedOut}
                isLast={session.questionIndex === scoredChallenge.questions.length - 1}
              />
            )}
            {session.phase === "results" && (
              <ResultScreen
                key="results"
                challenge={scoredChallenge}
                results={session.results}
                score={session.score}
                onReview={session.showReview}
                onReplay={session.replay}
              />
            )}
            {session.phase === "review" && (
              <ReviewAnswers
                key="review"
                challenge={scoredChallenge}
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
