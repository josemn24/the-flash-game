"use client";

import { useMemo } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { ChallengeIntro } from "@/components/ChallengeIntro";
import { QuestionScreen } from "@/components/QuestionScreen";
import { QuestionTransition } from "@/components/QuestionTransition";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { SpeedBackground } from "@/components/SpeedBackground";
import { SurvivalResultScreen } from "@/components/SurvivalResultScreen";
import { useSurvivalSession } from "@/features/game/useSurvivalSession";
import { withChallengeScoring } from "@/lib/challengeScoring";
import type { SurvivalChallenge } from "@/types/game";

export function SurvivalGameApp({ challenge }: { challenge: SurvivalChallenge }) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const session = useSurvivalSession(scoredChallenge);
  const latestResult = session.results.at(-1);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--ink)] text-white selection:bg-[var(--electric)] selection:text-black">
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
                livesRemaining={session.livesRemaining}
                totalLives={scoredChallenge.lives}
              />
            )}
            {session.phase === "transition" && (
              <QuestionTransition
                key={`transition-${session.questionIndex}`}
                timedOut={session.lastTimedOut}
                isLast={
                  session.eliminated ||
                  session.questionIndex === scoredChallenge.questions.length - 1
                }
                status={latestResult?.status}
                eliminated={session.eliminated}
              />
            )}
            {session.phase === "results" && (
              <SurvivalResultScreen
                key="results"
                challenge={scoredChallenge}
                results={session.results}
                score={session.score}
                livesRemaining={session.livesRemaining}
                reachedQuestionCount={session.reachedQuestionCount}
                eliminated={session.eliminated}
                survived={session.survived}
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
