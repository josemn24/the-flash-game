"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CheckIcon, ClockIcon, CrossIcon, Canvas, Timer } from "@/components/ui";
import type { AlphabetState } from "@/features/alphabet/alphabetGame";
import { useAlphabetSession } from "@/features/alphabet/useAlphabetSession";
import { buildAlphabetAnswerReviews } from "@/features/alphabet/alphabetReview";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import { calculateResultAccuracy } from "@/features/game/resultSummary";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { ChallengeResultScreen, StartCountdown } from "@/components/game/shared";
import {
  AlphabetPlayingPresentation,
  AlphabetReviewPresentation,
} from "@/components/game/modes/flash-pop/AlphabetPresentation";
import {
  useRoomAttemptResume,
  useRoomAttemptSnapshot,
} from "@/features/rooms/useRoomAttemptSnapshot";
import type {
  AlphabetChallenge,
  AnswerStatus,
  ChallengeCompletionResult,
  GameRoomContext,
} from "@/types/game";
import styles from "./FlashPopAlphabetGame.module.css";

function Intro({
  challenge,
  onStart,
  returnTo,
}: {
  challenge: AlphabetChallenge;
  onStart: () => void;
  returnTo?: string;
}) {
  return <ChallengeIntro challenge={challenge} onStart={onStart} returnTo={returnTo} />;
}

type AlphabetSession = ReturnType<typeof useAlphabetSession>;

function Playing({
  challenge,
  session,
}: {
  challenge: AlphabetChallenge;
  session: AlphabetSession;
}) {
  const entry = session.activeEntry;
  if (!entry || entry.question.type !== "short-text") return null;
  const locked = session.phase === "feedback";

  const correct = session.feedback === "correct";
  return (
    <AlphabetPlayingPresentation
      round={session.round}
      correctAnswers={session.correctAnswers}
      totalLetters={challenge.entries.length}
      timer={
        <Timer
          duration={challenge.timeLimit}
          active
          onTimeUp={session.finish}
          resetKey={`${challenge.id}-alphabet`}
          size="compact"
        />
      }
      letters={session.letters}
      question={entry.question}
      locked={locked}
      feedback={
        session.phase === "feedback"
          ? {
              id: `${session.round}-${session.currentIndex}`,
              isCorrect: correct,
              eyebrow: `Vuelta ${session.round} · ${session.correctAnswers} aciertos`,
              body: correct
                ? "La letra queda resuelta. Siguiente en marcha."
                : "La letra queda marcada. Puedes recuperarla en otra vuelta.",
            }
          : undefined
      }
      onSubmit={session.submitAnswer}
      onPass={session.pass}
    />
  );
}

function Results({
  challenge,
  session,
  returnTo,
}: {
  challenge: AlphabetChallenge;
  session: AlphabetSession;
  returnTo: string;
}) {
  const accuracy = calculateResultAccuracy([
    ...Array.from({ length: session.correctAnswers }, () => ({ status: "correct" as const })),
    ...Array.from({ length: Math.max(0, session.playedCount - session.correctAnswers) }, () => ({
      status: "unanswered" as const,
    })),
  ]);
  return (
    <ChallengeResultScreen
      model={{
        gameTitle: "Alfabeto",
        statusLabel: "Completado",
        eyebrow: "Desafío completado",
        title:
          session.correctAnswers === challenge.entries.length
            ? "Alfabeto dominado"
            : "Buen recorrido",
        score: session.score,
        maxScore: CHALLENGE_MAX_SCORE,
        scoreUnit: "flashPoints",
        accuracy,
        totalTime: session.elapsedTime,
        metrics: [
          {
            icon: <CheckIcon />,
            label: "Aciertos",
            value: session.correctAnswers,
            tone: "success",
          },
          {
            icon: <CrossIcon />,
            label: "Errores",
            value: session.incorrectAnswers,
            tone: "danger",
          },
          { icon: <ClockIcon />, label: "Letras sin resolver", value: session.unanswered },
        ],
      }}
      onReview={session.showReview}
      returnTo={returnTo}
      returnLabel="Volver"
    />
  );
}

function Review({
  challenge,
  session,
  roomContext,
}: {
  challenge: AlphabetChallenge;
  session: AlphabetSession;
  roomContext?: GameRoomContext;
}) {
  const entries = challenge.entries.map((entry, index) => {
    const letter = session.letters[index];
    const status: AnswerStatus =
      letter?.status === "correct"
        ? "correct"
        : letter?.status === "incorrect"
          ? "incorrect"
          : "unanswered";

    return {
      id: entry.question.id,
      question: entry.question,
      result: {
        questionId: entry.question.id,
        answer: letter?.answer ?? null,
        status,
        isCorrect: status === "correct",
        points: 0,
        timeUsed: 0,
      },
      marker: entry.letter,
      title: entry.question.question,
      subtitle: `Letra ${entry.letter}`,
      showMeta: false,
    };
  });

  return (
    <AlphabetReviewPresentation
      entries={entries}
      onBack={session.showResults}
      onReplay={roomContext ? undefined : session.replay}
    />
  );
}

export function FlashPopAlphabetGame({
  challenge,
  roomContext,
  onComplete,
}: {
  challenge: AlphabetChallenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
}) {
  const resumeState = useRoomAttemptResume<AlphabetState>(roomContext, challenge.id, "alphabet");
  const session = useAlphabetSession(challenge, { resumeState });
  useRoomAttemptSnapshot(roomContext, challenge.id, "alphabet", session.phase, session.snapshot);
  useChallengeCompletionReporter(
    session.phase === "results"
      ? {
          challengeId: challenge.id,
          startedAt:
            session.startedAt ??
            roomContext?.result?.attempt?.startedAt ??
            new Date().toISOString(),
          flashPoints: session.score,
          completed: true,
          durationMs: Math.round(session.elapsedTime * 1_000),
          answers: buildAlphabetAnswerReviews(challenge, session.letters),
        }
      : null,
    onComplete,
  );
  return (
    <MotionConfig reducedMotion="user">
      <Canvas
        maxWidth={session.phase === "intro" ? "none" : "wide"}
        contentClassName={session.phase === "intro" ? styles.introCanvasContent : styles.screen}
      >
        <AnimatePresence mode="wait">
          {session.phase === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Intro
                challenge={challenge}
                onStart={session.beginCountdown}
                returnTo={roomContext?.returnTo}
              />
            </motion.div>
          ) : null}
          {session.phase === "countdown" ? (
            <StartCountdown label="Alfabeto" key="countdown" onComplete={session.start} />
          ) : null}
          {session.phase === "playing" || session.phase === "feedback" ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
            >
              <Playing challenge={challenge} session={session} />
            </motion.div>
          ) : null}
          {session.phase === "results" ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <Results
                challenge={challenge}
                session={session}
                returnTo={roomContext?.returnTo ?? "/"}
              />
            </motion.div>
          ) : null}
          {session.phase === "review" ? (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <Review challenge={challenge} session={session} roomContext={roomContext} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
