"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CheckIcon, ClockIcon, CrossIcon } from "@/components/ui";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { ButtonLink, Card, Canvas, GameHeader, Timer } from "@/components/ui";
import {
  ChallengeResultScreen,
  ReviewAnswerPanel,
  StartCountdown,
  type ChallengeResultModel,
} from "@/components/game/shared";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { useGameSession } from "@/features/game/useGameSession";
import { FLASH_POP_FEEDBACK_DURATION } from "@/features/game/transitionTiming";
import { FLASH_POP_FLASH_PILOT_ID } from "@/features/flash-pop/demoSocial";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import { CHALLENGE_MAX_SCORE, withChallengeScoring } from "@/lib/challengeScoring";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import type {
  AnswerResult,
  ChallengeCompletionResult,
  FlashChallenge,
  GameRoomContext,
  Question,
  QuestionMedia as QuestionMediaType,
} from "@/types/game";
import styles from "./FlashPopFlashGame.module.css";

function getMedia(question: Question): QuestionMediaType | undefined {
  return "media" in question ? question.media : undefined;
}

function getPromptCopy(prompt: string) {
  const start = prompt.lastIndexOf("¿");
  if (start <= 0) return { title: prompt };
  return { context: prompt.slice(0, start).trim(), title: prompt.slice(start).trim() };
}

function Intro({
  challenge,
  onStart,
  returnTo,
}: {
  challenge: FlashChallenge;
  onStart: () => void;
  returnTo?: string;
}) {
  return <ChallengeIntro challenge={challenge} onStart={onStart} returnTo={returnTo} />;
}

function QuestionStage({
  challenge,
  question,
  questionIndex,
  locked,
  onSubmit,
  onTimeUp,
  onProgress,
  onIncorrectAttempt,
  onProgressiveClueReveal,
  onCodeAttempt,
  onTimedResponseStart,
  attemptCount,
}: {
  challenge: FlashChallenge;
  question: Question;
  questionIndex: number;
  locked: boolean;
  onSubmit: (answer: import("@/types/game").AnswerValue) => void;
  onTimeUp: () => void;
  onProgress: (answer: import("@/types/game").AnswerValue) => void;
  onIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onCodeAttempt: (code: string) => boolean;
  onTimedResponseStart: () => void;
  attemptCount: number;
}) {
  const delayedTimer =
    question.type === "flash-memory" ||
    question.type === "simon-sequence" ||
    question.type === "mini-wordle" ||
    question.type === "progressive-image";
  const [timedResponseStarted, setTimedResponseStarted] = useState(!delayedTimer);
  const prompt = getPromptCopy(question.question);
  const questionPosition = `${String(questionIndex + 1).padStart(2, "0")} de ${String(challenge.questions.length).padStart(2, "0")}`;
  const startTimedResponse = () => {
    setTimedResponseStarted(true);
    onTimedResponseStart();
  };

  return (
    <div className={styles.stage}>
      <GameHeader
        title="Flash clásico"
        mobileLabel={
          <>
            Pregunta {String(questionIndex + 1).padStart(2, "0")}{" "}
            <span className={styles.mobileLabelMuted}>
              de {String(challenge.questions.length).padStart(2, "0")}
            </span>
          </>
        }
        mobileLabelAriaLabel={`Pregunta ${questionPosition}`}
        timer={
          <Timer
            duration={question.timeLimit}
            active={!locked && timedResponseStarted}
            onTimeUp={onTimeUp}
            resetKey={question.id}
            size="compact"
          />
        }
      />
      <p
        className={styles.questionIndicator}
        aria-label={`Pregunta ${questionIndex + 1} de ${challenge.questions.length}`}
      >
        Pregunta {String(questionIndex + 1).padStart(2, "0")}{" "}
        <span>de {String(challenge.questions.length).padStart(2, "0")}</span>
      </p>

      <section className={styles.questionCard} aria-labelledby="flash-pop-question-title">
        {prompt.context ? <p className={styles.promptContext}>{prompt.context}</p> : null}
        <h1 id="flash-pop-question-title">{prompt.title}</h1>
        {getMedia(question) ? (
          <div className={styles.questionMedia}>
            <QuestionMedia media={getMedia(question)!} prominent />
          </div>
        ) : null}
        <QuestionInput
          question={question}
          locked={locked}
          onSubmit={onSubmit}
          onProgress={onProgress}
          onIncorrectAttempt={onIncorrectAttempt}
          onProgressiveClueReveal={onProgressiveClueReveal}
          onCodeAttempt={onCodeAttempt}
          onTimedResponseStart={startTimedResponse}
          codeAttemptCount={attemptCount}
        />
      </section>
    </div>
  );
}

function Transition({
  result,
  timedOut,
  isLast,
}: {
  result?: AnswerResult;
  timedOut: boolean;
  isLast: boolean;
}) {
  const status = result?.status ?? (timedOut ? "unanswered" : "incorrect");
  const { title, body } = getFlashPopFeedbackCopy({ status, timedOut, isLast });

  return (
    <FlashPopFeedback
      status={status}
      title={title}
      body={body}
      points={status === "correct" || status === "partial" ? result?.points : undefined}
    />
  );
}

function buildResultModel(results: AnswerResult[], score: number): ChallengeResultModel {
  const correct = results.filter((result) => result.status === "correct").length;
  const incorrect = results.filter((result) => result.status === "incorrect").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const accuracy = calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit));
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const message =
    accuracy >= 80 ? "Sprint brutal." : accuracy >= 50 ? "Buen ritmo." : "Desafío duro.";

  return {
    gameTitle: "Flash clásico",
    statusLabel: "Completado",
    eyebrow: "Desafío completado",
    title: message,
    score,
    maxScore: CHALLENGE_MAX_SCORE,
    accuracy,
    totalTime,
    metrics: [
      { icon: <CheckIcon />, label: "Correctas", value: correct, tone: "success" },
      { icon: <CrossIcon />, label: "Falladas", value: incorrect, tone: "danger" },
      { icon: <ClockIcon />, label: "Sin contestar", value: unanswered },
    ],
  };
}

function ReviewStage({
  challenge,
  results,
  onBack,
  onReplay,
  returnTo,
  roomContext,
}: {
  challenge: FlashChallenge;
  results: AnswerResult[];
  onBack: () => void;
  onReplay: () => void;
  returnTo: string;
  roomContext?: GameRoomContext;
}) {
  const resultByQuestionId = new Map(results.map((result) => [result.questionId, result]));
  const entries = challenge.questions.map((question, index) => ({
    id: question.id,
    question,
    result: resultByQuestionId.get(question.id),
    marker: String(index + 1).padStart(2, "0"),
  }));

  return (
    <div className={styles.stage}>
      <GameHeader
        title="Revisión"
        action={
          <ButtonLink href={returnTo} variant="secondary">
            {roomContext ? "Tabarnia" : "Lobby"}
          </ButtonLink>
        }
      />
      <ReviewAnswerPanel
        entries={entries}
        countLabel={`${results.length} respuestas`}
        title="Historial de respuestas"
        description="Consulta tu respuesta, la solución aceptada y la explicación de cada desafío."
        onBack={onBack}
        onReplay={onReplay}
      />
    </div>
  );
}

export function FlashPopFlashGame({
  challenge,
  roomContext,
  onComplete,
}: {
  challenge: FlashChallenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
}) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const session = useGameSession(scoredChallenge, {
    transitionDuration: FLASH_POP_FEEDBACK_DURATION,
  });
  const lastResult = session.results[session.results.length - 1];

  useChallengeCompletionReporter(
    session.phase === "results"
      ? {
          challengeId: challenge.id,
          points: session.score,
          completed: true,
          answers: session.results,
        }
      : null,
    onComplete,
  );

  if (challenge.id !== FLASH_POP_FLASH_PILOT_ID) {
    return (
      <MotionConfig reducedMotion="user">
        <Canvas maxWidth="content">
          <Card>
            <h1>Preview no disponible</h1>
            <p>Este piloto está limitado a tabarnia-flash-01.</p>
            <ButtonLink href={roomContext?.returnTo ?? "/flash-pop"}>"Volver"</ButtonLink>
          </Card>
        </Canvas>
      </MotionConfig>
    );
  }

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
                challenge={scoredChallenge}
                onStart={session.beginCountdown}
                returnTo={roomContext?.returnTo}
              />
            </motion.div>
          ) : null}
          {session.phase === "countdown" ? (
            <StartCountdown label="Flash clásico" key="countdown" onComplete={session.start} />
          ) : null}
          {session.phase === "playing" && session.question ? (
            <motion.div
              className={styles.stageFrame}
              key={session.question.id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
            >
              <QuestionStage
                challenge={scoredChallenge}
                question={session.question}
                questionIndex={session.questionIndex}
                locked={session.locked}
                onSubmit={session.submitAnswer}
                onTimeUp={session.handleTimeUp}
                onProgress={session.handleAnswerProgress}
                onIncorrectAttempt={session.handleIncorrectAttempt}
                onProgressiveClueReveal={session.handleProgressiveClueReveal}
                onCodeAttempt={session.handleCodeAttempt}
                onTimedResponseStart={session.handleTimedResponseStart}
                attemptCount={session.codeAttempts.length}
              />
            </motion.div>
          ) : null}
          {session.phase === "transition" ? (
            <motion.div
              key={`transition-${session.questionIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Transition
                result={lastResult}
                timedOut={session.lastTimedOut}
                isLast={session.questionIndex === scoredChallenge.questions.length - 1}
              />
            </motion.div>
          ) : null}
          {session.phase === "results" ? (
            <motion.div
              className={styles.stageFrame}
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ChallengeResultScreen
                model={buildResultModel(session.results, session.score)}
                onReview={session.showReview}
                returnTo={roomContext?.returnTo ?? "/flash-pop"}
              />
            </motion.div>
          ) : null}
          {session.phase === "review" ? (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ReviewStage
                challenge={scoredChallenge}
                results={session.results}
                onBack={session.showResults}
                onReplay={session.replay}
                returnTo={roomContext?.returnTo ?? "/flash-pop"}
                roomContext={roomContext}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
