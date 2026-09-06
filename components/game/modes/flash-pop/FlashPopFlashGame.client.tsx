"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowIcon, CheckIcon, ClockIcon, CrossIcon, EyeIcon, RotateIcon } from "@/components/ui";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { Button, ButtonLink, Card, Canvas, Chip, GameHeader, Timer } from "@/components/ui";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import { useGameSession } from "@/features/game/useGameSession";
import { FLASH_POP_FEEDBACK_DURATION } from "@/features/game/transitionTiming";
import { FLASH_POP_FLASH_PILOT_ID } from "@/features/flash-pop/demoSocial";
import { withChallengeScoring } from "@/lib/challengeScoring";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type {
  AnswerResult,
  AnswerStatus,
  FlashChallenge,
  Question,
  QuestionMedia as QuestionMediaType,
} from "@/types/game";
import styles from "./FlashPopFlashGame.module.css";

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

function getMedia(question: Question): QuestionMediaType | undefined {
  return "media" in question ? question.media : undefined;
}

function getPromptCopy(prompt: string) {
  const start = prompt.lastIndexOf("¿");
  if (start <= 0) return { title: prompt };
  return { context: prompt.slice(0, start).trim(), title: prompt.slice(start).trim() };
}

function statusLabel(status: AnswerStatus) {
  if (status === "correct") return "Correcta";
  if (status === "partial") return "Parcial";
  if (status === "unanswered") return "Sin respuesta";
  return "Fallada";
}

function statusTone(status: AnswerStatus): "success" | "social" | "danger" {
  if (status === "correct") return "success";
  if (status === "partial") return "social";
  return "danger";
}

function Intro({ challenge, onStart }: { challenge: FlashChallenge; onStart: () => void }) {
  const totalTime = challenge.questions.reduce((total, question) => total + question.timeLimit, 0);
  const formats = [
    ...new Set(challenge.questions.map((question) => QUESTION_FORMAT_LABELS[question.type])),
  ];

  return (
    <div className={styles.stage}>
      <GameHeader title="Flash clásico" action={<Chip tone="social">Preview</Chip>} />
      <Card as="section" className={styles.introCard} aria-labelledby="flash-pop-flash-title">
        <div className={styles.introAccent} aria-hidden="true">
          <span>16</span>
          <small>retos</small>
        </div>
        <Chip tone="social">Reto de hoy · Flash</Chip>
        <h1 id="flash-pop-flash-title">{challenge.title}</h1>
        <p className={styles.lead}>{challenge.subtitle}</p>
        <p className={styles.description}>{challenge.description}</p>

        <div className={styles.introStats} aria-label="Resumen del desafío">
          <div>
            <strong>{challenge.questions.length}</strong>
            <span>preguntas</span>
          </div>
          <div>
            <strong>{formatTime(totalTime)}</strong>
            <span>tiempo máximo</span>
          </div>
          <div>
            <strong>{formats.length}</strong>
            <span>formatos</span>
          </div>
        </div>

        <div className={styles.formatList} aria-label="Formatos incluidos">
          {formats.map((format) => (
            <Chip key={format} variant="data">
              {format}
            </Chip>
          ))}
        </div>

        <Button size="hero" fullWidth trailingIcon={<ArrowIcon />} onClick={onStart}>
          Empezar desafío
        </Button>
        <p className={styles.note}>
          La sesión conserva el mismo scoring, reloj y replay que Flash normal.
        </p>
      </Card>
    </div>
  );
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

function ResultStage({
  challenge,
  results,
  score,
  onReview,
  onReplay,
}: {
  challenge: FlashChallenge;
  results: AnswerResult[];
  score: number;
  onReview: () => void;
  onReplay: () => void;
}) {
  const correct = results.filter((result) => result.status === "correct").length;
  const incorrect = results.filter((result) => result.status === "incorrect").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const accuracyContribution = results.reduce(
    (total, result) =>
      total +
      (result.status === "correct"
        ? 1
        : result.details?.type === "estimation"
          ? result.details.proximity
          : 0),
    0,
  );
  const accuracy = Math.round((accuracyContribution / challenge.questions.length) * 100);
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const maxScore = challenge.questions.reduce((total, question) => total + question.points, 0);
  const message =
    accuracy >= 80 ? "Sprint brutal." : accuracy >= 50 ? "Buen ritmo." : "Desafío duro.";

  return (
    <div className={styles.stage}>
      <GameHeader title="Flash clásico" action={<Chip tone="success">Completado</Chip>} />
      <div className={styles.resultLayout}>
        <Card as="section" className={styles.resultCard} aria-labelledby="flash-pop-result-title">
          <p className={styles.eyebrow}>Desafío completado</p>
          <h1 id="flash-pop-result-title">{message}</h1>
          <div className={styles.scoreDisplay}>
            <motion.strong
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              {score}
            </motion.strong>
            <span>/{maxScore} puntos</span>
          </div>
          <div className={styles.scoreTrack} aria-label={`${score} de ${maxScore} puntos`}>
            <span style={{ width: `${maxScore ? Math.min(100, (score / maxScore) * 100) : 0}%` }} />
          </div>
          <div className={styles.resultActions}>
            <Button fullWidth onClick={onReplay} leadingIcon={<RotateIcon />}>
              Volver a jugar
            </Button>
            <Button variant="secondary" fullWidth onClick={onReview} leadingIcon={<EyeIcon />}>
              Ver respuestas
            </Button>
          </div>
        </Card>

        <div className={styles.resultStats}>
          <div className={styles.summaryStats}>
            <Card className={styles.accuracyCard}>
              <div>
                <p className={styles.eyebrow}>Precisión</p>
                <strong>{accuracy}%</strong>
              </div>
              <div
                className={styles.accuracyRing}
                style={{ "--accuracy": `${accuracy * 3.6}deg` } as React.CSSProperties}
                aria-hidden="true"
              />
            </Card>
            <div className={styles.timeStat}>
              <StatCard icon={<ClockIcon />} value={formatTime(totalTime)} label="Tiempo total" />
            </div>
          </div>
          <div className={styles.answerStats}>
            <StatCard icon={<CheckIcon />} value={correct} label="Correctas" tone="success" />
            <StatCard icon={<CrossIcon />} value={incorrect} label="Falladas" tone="danger" />
            <StatCard icon={<ClockIcon />} value={unanswered} label="Sin contestar" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tone?: "success" | "danger";
}) {
  return (
    <Card
      className={`${styles.statCard} ${tone === "success" ? styles.statSuccess : tone === "danger" ? styles.statDanger : ""}`}
    >
      <div className={styles.statHeader}>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
    </Card>
  );
}

function ReviewStage({
  challenge,
  results,
  onBack,
  onReplay,
}: {
  challenge: FlashChallenge;
  results: AnswerResult[];
  onBack: () => void;
  onReplay: () => void;
}) {
  return (
    <div className={styles.stage}>
      <GameHeader
        title="Revisión"
        action={
          <ButtonLink href="/flash-pop" variant="secondary">
            Lobby
          </ButtonLink>
        }
      />
      <Card as="section" className={styles.reviewCard} aria-labelledby="flash-pop-review-title">
        <div className={styles.reviewHeading}>
          <div>
            <p className={styles.eyebrow}>Revisión · Flash</p>
            <h1 id="flash-pop-review-title">Tus respuestas</h1>
          </div>
          <Chip tone="social">
            {results.length}/{challenge.questions.length}
          </Chip>
        </div>
        <div className={styles.reviewList}>
          {challenge.questions.map((question, index) => {
            const result = results[index];
            return (
              <details
                className={styles.reviewItem}
                key={question.id}
                open={index === results.length - 1}
              >
                <summary>
                  <span className={styles.reviewNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.reviewTitle}>
                    <strong>{QUESTION_FORMAT_LABELS[question.type]}</strong>
                    <small>{question.question}</small>
                  </span>
                  {result ? (
                    <Chip tone={statusTone(result.status)}>{statusLabel(result.status)}</Chip>
                  ) : (
                    <Chip variant="data">No alcanzada</Chip>
                  )}
                </summary>
                {result ? (
                  <div className={styles.reviewBody}>
                    <QuestionReviewContent question={question} result={result} />
                    <div className={styles.reviewMeta}>
                      <span>{result.timeUsed.toFixed(1)} s</span>
                      <strong>
                        {result.points > 0 ? "+" : ""}
                        {result.points} pts
                      </strong>
                    </div>
                    <p className={styles.explanation}>{question.explanation}</p>
                  </div>
                ) : null}
              </details>
            );
          })}
        </div>
        <div className={styles.reviewActions}>
          <Button variant="secondary" fullWidth onClick={onBack}>
            Volver al resultado
          </Button>
          <Button fullWidth onClick={onReplay} leadingIcon={<RotateIcon />}>
            Jugar de nuevo
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function FlashPopFlashGame({ challenge }: { challenge: FlashChallenge }) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const session = useGameSession(scoredChallenge, {
    transitionDuration: FLASH_POP_FEEDBACK_DURATION,
  });
  const lastResult = session.results[session.results.length - 1];

  if (challenge.id !== FLASH_POP_FLASH_PILOT_ID) {
    return (
      <MotionConfig reducedMotion="user">
        <Canvas maxWidth="content">
          <Card>
            <h1>Preview no disponible</h1>
            <p>Este piloto está limitado a tabarnia-flash-01.</p>
            <ButtonLink href="/flash-pop">Volver al lobby</ButtonLink>
          </Card>
        </Canvas>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <Canvas contentClassName={styles.screen}>
        <AnimatePresence mode="wait">
          {session.phase === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Intro challenge={scoredChallenge} onStart={session.start} />
            </motion.div>
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
              <ResultStage
                challenge={scoredChallenge}
                results={session.results}
                score={session.score}
                onReview={session.showReview}
                onReplay={session.replay}
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
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
