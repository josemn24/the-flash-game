"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  EyeIcon,
  RotateIcon,
} from "@/components/icons";
import { QuestionMedia } from "@/components/QuestionMedia";
import { FlashPopQuestionInput } from "@/components/flash-pop/FlashPopQuestionInput";
import {
  PopButton,
  PopButtonLink,
  PopCard,
  PopCanvas,
  PopChip,
  PopGameHeader,
  PopTimer,
} from "@/components/flash-pop/ui";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import { useGameSession } from "@/features/game/useGameSession";
import { withChallengeScoring } from "@/lib/challengeScoring";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type { AnswerResult, AnswerStatus, FlashChallenge, Question, QuestionMedia as QuestionMediaType } from "@/types/game";
import styles from "./FlashPopFlashGame.module.css";

const PILOT_CHALLENGE_ID = "tabarnia-flash-01";

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

function StatusIcon({ status }: { status: AnswerStatus }) {
  if (status === "correct") return <CheckIcon aria-hidden="true" />;
  if (status === "unanswered") return <ClockIcon aria-hidden="true" />;
  return <CrossIcon aria-hidden="true" />;
}

function Intro({ challenge, onStart }: { challenge: FlashChallenge; onStart: () => void }) {
  const totalTime = challenge.questions.reduce((total, question) => total + question.timeLimit, 0);
  const formats = [...new Set(challenge.questions.map((question) => QUESTION_FORMAT_LABELS[question.type]))];

  return (
    <div className={styles.stage}>
      <PopGameHeader title="Flash clásico" action={<PopChip tone="social">Preview</PopChip>} />
      <PopCard as="section" className={styles.introCard} aria-labelledby="flash-pop-flash-title">
        <div className={styles.introAccent} aria-hidden="true">
          <span>16</span>
          <small>retos</small>
        </div>
        <PopChip tone="social">Reto de hoy · Flash</PopChip>
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
            <PopChip key={format} variant="data">
              {format}
            </PopChip>
          ))}
        </div>

        <PopButton size="hero" fullWidth trailingIcon={<ArrowIcon />} onClick={onStart}>
          Empezar desafío
        </PopButton>
        <p className={styles.note}>La sesión conserva el mismo scoring, reloj y replay que Flash normal.</p>
      </PopCard>
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
  const startTimedResponse = () => {
    setTimedResponseStarted(true);
    onTimedResponseStart();
  };
  const progress = ((questionIndex + 1) / challenge.questions.length) * 100;

  return (
    <div className={styles.stage}>
      <PopGameHeader
        title="Flash clásico"
        timer={
          <PopTimer
            duration={question.timeLimit}
            active={!locked && timedResponseStarted}
            onTimeUp={onTimeUp}
            resetKey={question.id}
            size="compact"
          />
        }
        action={<PopChip variant="data">{QUESTION_FORMAT_LABELS[question.type]}</PopChip>}
      />
      <div className={styles.questionProgress} aria-label={`Pregunta ${questionIndex + 1} de ${challenge.questions.length}`}>
        <div className={styles.progressMeta}>
          <span>Pregunta {String(questionIndex + 1).padStart(2, "0")}</span>
          <span>{String(challenge.questions.length).padStart(2, "0")}</span>
        </div>
        <div className={styles.progressTrack}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section className={styles.questionCard} aria-labelledby="flash-pop-question-title">
        {prompt.context ? <p className={styles.promptContext}>{prompt.context}</p> : null}
        <h1 id="flash-pop-question-title" className={prompt.title.length > 100 ? styles.longPrompt : ""}>
          {prompt.title}
        </h1>
        {getMedia(question) ? (
          <div className={styles.questionMedia}>
            <QuestionMedia media={getMedia(question)!} prominent />
          </div>
        ) : null}
        <FlashPopQuestionInput
          question={question}
          locked={locked}
          onSubmit={onSubmit}
          onProgress={onProgress}
          onIncorrectAttempt={onIncorrectAttempt}
          onProgressiveClueReveal={onProgressiveClueReveal}
          onCodeAttempt={onCodeAttempt}
          onTimedResponseStart={startTimedResponse}
          attemptCount={attemptCount}
        />
      </section>
    </div>
  );
}

function Transition({ result, timedOut, isLast }: { result?: AnswerResult; timedOut: boolean; isLast: boolean }) {
  const status = result?.status ?? (timedOut ? "unanswered" : "incorrect");
  const isDanger = status === "incorrect" || status === "unanswered";
  const title = timedOut
    ? "Tiempo agotado"
    : status === "correct"
      ? "Respuesta correcta"
      : status === "partial"
        ? "Aproximación válida"
        : "Respuesta fallada";
  const body = isLast ? "Calculando tu resultado…" : status === "correct" ? "Siguiente pregunta en marcha." : "Sigue: aún quedan retos.";

  return (
    <motion.div
      className={styles.transitionStage}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
    >
      <div className={`${styles.transitionIcon} ${isDanger ? styles.transitionDanger : ""}`}>
        <StatusIcon status={status} />
      </div>
      <p className={styles.eyebrow}>Flash Pop · feedback</p>
      <h1>{title}</h1>
      <p>{body}</p>
      <div className={styles.transitionDots} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </motion.div>
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
  const partial = results.filter((result) => result.status === "partial").length;
  const incorrect = results.filter((result) => result.status === "incorrect").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const accuracyContribution = results.reduce(
    (total, result) => total + (result.status === "correct" ? 1 : result.details?.type === "estimation" ? result.details.proximity : 0),
    0,
  );
  const accuracy = Math.round((accuracyContribution / challenge.questions.length) * 100);
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const maxScore = challenge.questions.reduce((total, question) => total + question.points, 0);
  const message = accuracy >= 80 ? "Sprint brutal." : accuracy >= 50 ? "Buen ritmo." : "Desafío duro.";

  return (
    <div className={styles.stage}>
      <PopGameHeader title="Flash clásico" action={<PopChip tone="success">Completado</PopChip>} />
      <div className={styles.resultLayout}>
        <PopCard as="section" className={styles.resultCard} aria-labelledby="flash-pop-result-title">
          <p className={styles.eyebrow}>Desafío completado</p>
          <h1 id="flash-pop-result-title">{message}</h1>
          <div className={styles.scoreDisplay}>
            <motion.strong initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              {score}
            </motion.strong>
            <span>/{maxScore} puntos</span>
          </div>
          <div className={styles.scoreTrack} aria-label={`${score} de ${maxScore} puntos`}>
            <span style={{ width: `${maxScore ? Math.min(100, (score / maxScore) * 100) : 0}%` }} />
          </div>
          <div className={styles.resultActions}>
            <PopButton fullWidth onClick={onReplay} leadingIcon={<RotateIcon />}>
              Volver a jugar
            </PopButton>
            <PopButton variant="secondary" fullWidth onClick={onReview} leadingIcon={<EyeIcon />}>
              Ver respuestas
            </PopButton>
          </div>
        </PopCard>

        <div className={styles.resultStats}>
          <PopCard className={styles.accuracyCard}>
            <div>
              <p className={styles.eyebrow}>Precisión</p>
              <strong>{accuracy}%</strong>
              <span>{correct} correctas · {partial} parciales</span>
            </div>
            <div className={styles.accuracyRing} style={{ "--accuracy": `${accuracy * 3.6}deg` } as React.CSSProperties}>
              <span>{accuracy}%</span>
            </div>
          </PopCard>
          <div className={styles.statGrid}>
            <StatCard icon={<CheckIcon />} value={correct} label="Correctas" tone="success" />
            <StatCard icon={<CrossIcon />} value={incorrect} label="Falladas" tone="danger" />
            <StatCard icon={<ClockIcon />} value={unanswered} label="Sin contestar" />
            <StatCard icon={<ClockIcon />} value={formatTime(totalTime)} label="Tiempo total" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string | number; label: string; tone?: "success" | "danger" }) {
  return (
    <PopCard className={`${styles.statCard} ${tone === "success" ? styles.statSuccess : tone === "danger" ? styles.statDanger : ""}`}>
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </PopCard>
  );
}

function ReviewStage({ challenge, results, onBack, onReplay }: { challenge: FlashChallenge; results: AnswerResult[]; onBack: () => void; onReplay: () => void }) {
  return (
    <div className={styles.stage}>
      <PopGameHeader title="Revisión" action={<PopButtonLink href="/flash-pop" variant="secondary">Lobby</PopButtonLink>} />
      <PopCard as="section" className={styles.reviewCard} aria-labelledby="flash-pop-review-title">
        <div className={styles.reviewHeading}>
          <div>
            <p className={styles.eyebrow}>Revisión · Flash</p>
            <h1 id="flash-pop-review-title">Tus respuestas</h1>
          </div>
          <PopChip tone="social">{results.length}/{challenge.questions.length}</PopChip>
        </div>
        <div className={styles.reviewList}>
          {challenge.questions.map((question, index) => {
            const result = results[index];
            return (
              <details className={styles.reviewItem} key={question.id} open={index === results.length - 1}>
                <summary>
                  <span className={styles.reviewNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.reviewTitle}><strong>{QUESTION_FORMAT_LABELS[question.type]}</strong><small>{question.question}</small></span>
                  {result ? <PopChip tone={statusTone(result.status)}>{statusLabel(result.status)}</PopChip> : <PopChip variant="data">No alcanzada</PopChip>}
                </summary>
                {result ? (
                  <div className={styles.reviewBody}>
                    <QuestionReviewContent question={question} result={result} />
                    <div className={styles.reviewMeta}><span>{result.timeUsed.toFixed(1)} s</span><strong>{result.points > 0 ? "+" : ""}{result.points} pts</strong></div>
                    <p className={styles.explanation}>{question.explanation}</p>
                  </div>
                ) : null}
              </details>
            );
          })}
        </div>
        <div className={styles.reviewActions}>
          <PopButton variant="secondary" fullWidth onClick={onBack}>Volver al resultado</PopButton>
          <PopButton fullWidth onClick={onReplay} leadingIcon={<RotateIcon />}>Jugar de nuevo</PopButton>
        </div>
      </PopCard>
    </div>
  );
}

export function FlashPopFlashGame({ challenge }: { challenge: FlashChallenge }) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const session = useGameSession(scoredChallenge);
  const lastResult = session.results[session.results.length - 1];

  if (challenge.id !== PILOT_CHALLENGE_ID) {
    return (
      <MotionConfig reducedMotion="user">
        <PopCanvas maxWidth="content"><PopCard><h1>Preview no disponible</h1><p>Este piloto está limitado a tabarnia-flash-01.</p><PopButtonLink href="/flash-pop">Volver al lobby</PopButtonLink></PopCard></PopCanvas>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <PopCanvas contentClassName={styles.screen}>
        <AnimatePresence mode="wait">
          {session.phase === "intro" ? <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Intro challenge={scoredChallenge} onStart={session.start} /></motion.div> : null}
          {session.phase === "playing" && session.question ? <motion.div key={session.question.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><QuestionStage challenge={scoredChallenge} question={session.question} questionIndex={session.questionIndex} locked={session.locked} onSubmit={session.submitAnswer} onTimeUp={session.handleTimeUp} onProgress={session.handleAnswerProgress} onIncorrectAttempt={session.handleIncorrectAttempt} onProgressiveClueReveal={session.handleProgressiveClueReveal} onCodeAttempt={session.handleCodeAttempt} onTimedResponseStart={session.handleTimedResponseStart} attemptCount={session.codeAttempts.length} /></motion.div> : null}
          {session.phase === "transition" ? <Transition key={`transition-${session.questionIndex}`} result={lastResult} timedOut={session.lastTimedOut} isLast={session.questionIndex === scoredChallenge.questions.length - 1} /> : null}
          {session.phase === "results" ? <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ResultStage challenge={scoredChallenge} results={session.results} score={session.score} onReview={session.showReview} onReplay={session.replay} /></motion.div> : null}
          {session.phase === "review" ? <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ReviewStage challenge={scoredChallenge} results={session.results} onBack={session.showResults} onReplay={session.replay} /></motion.div> : null}
        </AnimatePresence>
      </PopCanvas>
    </MotionConfig>
  );
}
