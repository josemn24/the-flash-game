"use client";

import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { Button, Card, Canvas, Timer } from "@/components/ui";
import { ChallengeIntro, ChallengeResultScreen, StartCountdown } from "@/components/game/shared";
import { buildReviewAnswerEntries } from "@/components/game/shared/ReviewAnswerList";
import {
  AlphabetPlayingPresentation,
  AlphabetReviewPresentation,
} from "@/components/game/modes/flash-pop/AlphabetPresentation";
import { useServerAlphabetSession } from "@/features/game/useServerAlphabetSession";
import type { GameRoomContext } from "@/types/game";
import type {
  ServerAlphabetChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import styles from "./FlashPopAlphabetGame.module.css";

export function ServerFlashPopAlphabetGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerAlphabetChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useServerAlphabetSession({ challenge, roomContext, terminalReview });
  const isIntro = session.phase === "intro";
  const letters =
    session.progress?.letters ??
    challenge.entries.map((entry) => ({
      letter: entry.letter,
      status: "unvisited" as const,
    }));

  let content;
  if (session.phase === "intro") {
    content = (
      <motion.div
        key="intro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <ChallengeIntro
          introduction={{
            title: challenge.title,
            mode: "alphabet",
            questionCount: challenge.entries.length,
            maxScore: challenge.maxScore,
          }}
          onStart={session.begin}
          canStart
          notice={session.startNotice}
          returnTo={roomContext.returnTo}
        />
      </motion.div>
    );
  } else if (session.phase === "recovering") {
    content = (
      <motion.div
        key="recovering"
        className={styles.stage}
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
      >
        <Card>
          <h1>Recuperando partida</h1>
          <p>{session.startNotice ?? "Comprobamos el estado seguro de tu intento."}</p>
          {session.startNotice ? (
            <Button type="button" onClick={session.retryRecovery} disabled={session.busy}>
              {session.busy ? "Reintentando…" : "Reintentar recuperación"}
            </Button>
          ) : null}
        </Card>
      </motion.div>
    );
  } else if (session.phase === "countdown") {
    content = (
      <StartCountdown label="Alfabeto" key="countdown" onComplete={session.startQuestions} />
    );
  } else if (session.phase === "results") {
    const correct = session.results.filter((result) => result.isCorrect).length;
    content = (
      <motion.div
        key="results"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -12 }}
      >
        <ChallengeResultScreen
          model={{
            gameTitle: "Alfabeto",
            statusLabel: "Completado",
            eyebrow: "Desafío completado",
            title: correct === challenge.entries.length ? "Alfabeto dominado" : "Buen recorrido",
            score: session.score,
            maxScore: challenge.maxScore,
            scoreUnit: "flashPoints",
            accuracy: challenge.entries.length ? (correct / challenge.entries.length) * 100 : 0,
            totalTime: session.results.reduce((total, result) => total + result.timeUsed, 0),
            metrics: [
              { label: "Aciertos", value: correct, tone: "success" },
              {
                label: "Errores",
                value: session.results.filter((result) => !result.isCorrect).length,
                tone: "danger",
              },
              { label: "Letras", value: challenge.entries.length },
            ],
          }}
          onReview={session.showReview}
          returnTo={roomContext.returnTo}
        />
      </motion.div>
    );
  } else if (session.phase === "review" && session.reviewChallenge) {
    const entries = buildReviewAnswerEntries(session.reviewChallenge, session.results).map(
      (entry, index) => {
        const alphabetEntry = session.reviewChallenge?.entries[index];
        return {
          ...entry,
          marker: alphabetEntry?.letter ?? entry.marker,
          title: alphabetEntry?.question.question ?? entry.title,
          subtitle: alphabetEntry ? `Letra ${alphabetEntry.letter}` : entry.subtitle,
          showMeta: false,
        };
      },
    );
    content = (
      <motion.div
        key="review"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -12 }}
      >
        <AlphabetReviewPresentation entries={entries} onBack={session.showResults} />
      </motion.div>
    );
  } else {
    const correct = session.lastResult?.isCorrect ?? false;
    content = (
      <motion.div
        key="playing"
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -18 }}
      >
        <AlphabetPlayingPresentation
          round={session.progress?.round ?? 1}
          correctAnswers={session.progress?.correctAnswers ?? 0}
          totalLetters={challenge.entries.length}
          timer={
            <Timer
              duration={challenge.timeLimitMs / 1000}
              active={!session.locked}
              deadlineAt={session.deadlineAt ?? undefined}
              onTimeUp={session.onTimeUp}
              resetKey={challenge.id}
              size="compact"
            />
          }
          letters={letters}
          question={session.question}
          locked={session.locked}
          busy={session.busy}
          error={session.error}
          feedback={
            session.lastResult
              ? {
                  id: session.lastResult.questionId,
                  isCorrect: correct,
                  eyebrow: `Vuelta ${session.progress?.round ?? 1} · ${session.progress?.correctAnswers ?? 0} aciertos`,
                  body: correct
                    ? "La letra queda resuelta. Siguiente en marcha."
                    : "La letra queda marcada. Puedes recuperarla en otra vuelta.",
                }
              : undefined
          }
          onSubmit={(answer) => void session.submit(answer)}
          onPass={() => void session.pass()}
        />
      </motion.div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <Canvas
        data-gameplay-shell="flash-pop-alphabet"
        data-gameplay-layout={session.phase}
        maxWidth={isIntro ? "none" : "wide"}
        contentClassName={isIntro ? styles.introCanvasContent : styles.screen}
      >
        <AnimatePresence mode="wait">{content}</AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
