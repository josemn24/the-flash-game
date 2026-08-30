"use client";

import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowIcon, BoltIcon, CheckIcon, ClockIcon, CrossIcon } from "@/components/icons";
import {
  PopAvatar,
  PopButton,
  PopButtonLink,
  PopCanvas,
  PopCard,
  PopChip,
  PopTimer,
} from "@/components/flash-pop/ui";
import { usePyramidSession } from "@/features/pyramid/usePyramidSession";
import {
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_SLICE_LEVEL_COUNT,
  FLASH_POP_SLICE_TIME_LIMIT,
  FLASH_POP_STORAGE_NAMESPACE,
  getFlashPopResult,
  type FlashPopResult,
} from "@/features/flash-pop/demoSocial";
import type { PyramidChallenge, PyramidLevel, QuestionOfType } from "@/types/game";
import styles from "./FlashPopPyramidGame.module.css";

function getSliceChallenge(challenge: PyramidChallenge): PyramidChallenge {
  return { ...challenge, levels: challenge.levels.slice(0, FLASH_POP_SLICE_LEVEL_COUNT) };
}

function formatTime(seconds: number) {
  return seconds < 60 ? `${Math.round(seconds)} s` : `${Math.floor(seconds / 60)} min`;
}

function getOddOneOutQuestion(level: PyramidLevel): QuestionOfType<"odd-one-out"> | null {
  return level.question.type === "odd-one-out" ? level.question : null;
}

function Topbar({ timer }: { timer?: React.ReactNode }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <span className={styles.brandMark} aria-hidden="true">
          <BoltIcon />
        </span>
        <span className={styles.brandCopy}>
          <strong>La Pirámide</strong>
        </span>
      </div>
      {timer ? <div className={styles.topbarRight}>{timer}</div> : null}
    </div>
  );
}

function Intro({
  challenge,
  storageAvailable,
  confirming,
  onConfirm,
  onCancel,
  onStart,
}: {
  challenge: PyramidChallenge;
  storageAvailable: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  return (
    <div className={styles.intro}>
      <Topbar />
      <PopCard as="section" className={styles.introCard} aria-labelledby="flash-pop-intro-title">
        <div className={styles.introIllustration} aria-hidden="true" />
        <PopChip tone="social">Reto de hoy · Demo</PopChip>
        <h1 id="flash-pop-intro-title">La Pirámide</h1>
        <p className={styles.introLead}>El primer nivel del nuevo recorrido Flash Pop.</p>

        <div className={styles.rules}>
          <div className={styles.rule}>
            <strong>Un nivel</strong>
            <span>Encontrar el intruso y demostrar tu intuición.</span>
          </div>
          <div className={styles.rule}>
            <strong>Un intento</strong>
            <span>Tu respuesta oficial no se puede repetir.</span>
          </div>
        </div>

        {storageAvailable ? null : (
          <p className={styles.storageWarning} role="alert">
            Esta partida no se recuperará después de recargar la página.
          </p>
        )}

        <PopButton size="hero" fullWidth className={styles.action} onClick={onConfirm}>
          Empezar intento <ArrowIcon />
        </PopButton>
        <p className={styles.attemptNote}>
          {challenge.levels[0]?.question.timeLimit ?? FLASH_POP_SLICE_TIME_LIMIT} segundos · Hasta
          +120 ⚡
        </p>
      </PopCard>

      {confirming ? (
        <div
          className={styles.feedbackCard}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <h1 id="confirm-title">¿Listo para subir?</h1>
          <p>Tienes un único intento oficial. El reloj comienza al mostrar la pregunta.</p>
          <PopButton size="hero" fullWidth onClick={onStart}>
            Confirmar intento <ArrowIcon />
          </PopButton>
          <PopButton variant="secondary" fullWidth onClick={onCancel}>
            Todavía no
          </PopButton>
        </div>
      ) : null}
    </div>
  );
}

function Briefing({ level, onStart }: { level: PyramidLevel; onStart: () => void }) {
  return (
    <div className={styles.briefing}>
      <Topbar />
      <PopCard as="section" className={styles.briefingCard} aria-labelledby="briefing-title">
        <p className={styles.eyebrow}>Entrada · Nivel 1</p>
        <h1 id="briefing-title">{level.briefing.title}</h1>
        <p className={styles.briefingDescription}>{level.briefing.description}</p>
        <div className={styles.briefingStats} aria-label="Condiciones del nivel">
          <div className={styles.briefingStat}>
            <strong>{formatTime(level.question.timeLimit)}</strong>
            <span>tiempo</span>
          </div>
          <div className={styles.briefingStat}>
            <strong>+120 ⚡</strong>
            <span>máximo de temporada</span>
          </div>
        </div>
        <PopButton size="hero" fullWidth className={styles.briefingAction} onClick={onStart}>
          Ver pregunta <ArrowIcon />
        </PopButton>
      </PopCard>
    </div>
  );
}

function Question({
  question,
  deadlineAt,
  onReady,
  onSubmit,
  onTimeUp,
}: {
  question: QuestionOfType<"odd-one-out">;
  deadlineAt: number | null;
  onReady: () => void;
  onSubmit: (answer: string) => void;
  onTimeUp: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => onReady(), [onReady]);

  return (
    <div className={styles.question}>
      <Topbar
        timer={
          <PopTimer
            duration={question.timeLimit}
            active={typeof deadlineAt === "number"}
            deadlineAt={deadlineAt ?? undefined}
            onTimeUp={onTimeUp}
            resetKey={question.id}
          />
        }
      />
      <PopCard as="section" className={styles.questionCard} aria-labelledby="question-title">
        <p className={styles.levelTag}>Entrada</p>
        <h1 id="question-title" className={styles.questionPrompt}>
          {question.question}
        </h1>
        <div className={styles.answerGrid} aria-label="Opciones de respuesta">
          {question.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.answerTile} ${selected === item.id ? styles.selected : ""}`}
              aria-pressed={selected === item.id}
              disabled={selected !== null}
              onClick={() => {
                setSelected(item.id);
                onSubmit(item.id);
              }}
            >
              {selected === item.id ? (
                <span className={styles.answerContent}>
                  <CheckIcon aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              ) : (
                item.label
              )}
            </button>
          ))}
        </div>
      </PopCard>
    </div>
  );
}

function Feedback({
  result,
  question,
}: {
  result: NonNullable<ReturnType<typeof usePyramidSession>["latestResult"]>;
  question: QuestionOfType<"odd-one-out">;
}) {
  const passed = result.status === "correct" && result.isCorrect;
  const timedOut = result.status === "unanswered";
  const correctItem = question.items.find((item) => item.id === question.correctAnswer);
  const title = passed ? "¡Bien visto!" : timedOut ? "¡Se escapó por poco!" : "Casi.";
  const body = passed
    ? question.explanation
    : timedOut
      ? `La respuesta correcta era ${correctItem?.label ?? "27"}.`
      : `${correctItem?.label ?? "27"} era el único número que rompía el patrón.`;

  return (
    <div className={styles.question}>
      <Topbar />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <PopCard className={`${styles.feedbackCard} ${passed ? "" : styles.failure}`}>
          <span className={styles.feedbackIcon} aria-hidden="true">
            {passed ? <CheckIcon /> : timedOut ? <ClockIcon /> : <CrossIcon />}
          </span>
          <h1>{title}</h1>
          <p>{body}</p>
          {!passed && correctItem ? (
            <p className={styles.correctAnswer}>Respuesta: {correctItem.label}</p>
          ) : null}
        </PopCard>
      </motion.div>
    </div>
  );
}

function Result({ result, onReview }: { result: FlashPopResult; onReview: () => void }) {
  return (
    <div className={styles.result}>
      <Topbar />
      <PopCard as="section" className={styles.resultCard} aria-labelledby="result-title">
        <PopChip variant="reward">Resultado · Demo</PopChip>
        <h1 id="result-title">Nivel completado</h1>
        <div className={styles.resultScore}>{result.score}</div>
        <p className={styles.resultScoreLabel}>puntos de partida</p>
        <div className={styles.resultMeta}>
          <div className={styles.resultStat}>
            <strong>{result.playerRank}.º</strong>
            <span>posición · {result.totalPlayers}</span>
          </div>
          <div className={styles.resultStat}>
            <strong>+{result.seasonXpEarned} ⚡</strong>
            <span>XP de temporada</span>
          </div>
        </div>
        <p className={styles.xpCallout}>
          {result.seasonXpCurrent} / {result.nextLevelAt} ⚡ · Sigue subiendo
        </p>

        <div className={styles.ranking} aria-label="Clasificación demo">
          <h2>
            Tu grupo <span className={styles.metaLabel}>· Demo</span>
          </h2>
          {result.peers.map((row) => (
            <div
              className={`${styles.rankingRow} ${row.player.id === "javi" ? styles.current : ""}`}
              key={row.player.id}
            >
              <span className={styles.rankingPosition}>{row.rank}.</span>
              <PopAvatar
                name={row.player.displayName}
                initials={row.player.initials}
                tone={row.player.tone}
                size="sm"
              />
              <span className={styles.rankingName}>
                {row.player.id === "javi" ? "Tú" : row.player.displayName}
              </span>
              <span className={styles.rankingScore}>{row.score} pts</span>
            </div>
          ))}
        </div>

        <PopButtonLink href="/flash-pop" size="hero" fullWidth className={styles.action}>
          Volver al lobby <ArrowIcon />
        </PopButtonLink>
        <PopButton variant="secondary" fullWidth className={styles.action} onClick={onReview}>
          Revisar respuesta
        </PopButton>
      </PopCard>
    </div>
  );
}

function Review({
  result,
  question,
  onBack,
}: {
  result: NonNullable<ReturnType<typeof usePyramidSession>["latestResult"]>;
  question: QuestionOfType<"odd-one-out">;
  onBack: () => void;
}) {
  const answerId = typeof result.answer === "string" ? result.answer : null;
  const answer = question.items.find((item) => item.id === answerId)?.label ?? "Sin respuesta";
  const correct = question.items.find((item) => item.id === question.correctAnswer)?.label;

  return (
    <div className={styles.review}>
      <Topbar />
      <PopCard as="section" className={styles.reviewCard} aria-labelledby="review-title">
        <div className={styles.reviewHeader}>
          <div>
            <p className={styles.eyebrow}>Revisión</p>
            <h1 id="review-title">Encontrar el intruso</h1>
          </div>
          <PopChip tone={result.isCorrect ? "success" : "danger"}>
            {result.isCorrect ? "Correcta" : "Fallada"}
          </PopChip>
        </div>
        <p className={styles.reviewCopy}>{question.question}</p>
        <div className={styles.reviewAnswer}>Tu respuesta: {answer}</div>
        <p className={styles.reviewExplanation}>
          La respuesta correcta era <strong>{correct}</strong>. {question.explanation}
        </p>
        <PopButton variant="secondary" fullWidth className={styles.action} onClick={onBack}>
          Volver al resultado
        </PopButton>
      </PopCard>
    </div>
  );
}

export function FlashPopPyramidGame({ challenge }: { challenge: PyramidChallenge }) {
  const sliceChallenge = useMemo(() => getSliceChallenge(challenge), [challenge]);
  const session = usePyramidSession(sliceChallenge, {
    storageNamespace: FLASH_POP_STORAGE_NAMESPACE,
    feedbackDuration: { correct: 900, incorrect: 1500, unanswered: 1500 },
  });
  const sliceLevel = sliceChallenge.levels[0];
  const currentLevel = session.currentLevel ?? sliceLevel;
  const question = getOddOneOutQuestion(currentLevel);

  if (challenge.id !== FLASH_POP_CHALLENGE_ID || !sliceLevel || !question) {
    return (
      <PopCanvas maxWidth="content">
        <PopCard>
          <h1>Reto no disponible</h1>
          <p>Este preview solo contiene el primer nivel de La Pirámide.</p>
          <PopButtonLink href="/flash-pop" className={styles.action}>
            Volver al lobby
          </PopButtonLink>
        </PopCard>
      </PopCanvas>
    );
  }

  const result = session.summary ? getFlashPopResult(session.summary) : null;

  return (
    <MotionConfig reducedMotion="user">
      <PopCanvas contentClassName={styles.screen}>
        <AnimatePresence mode="wait">
          {session.phase === "loading" ? (
            <motion.div
              key="loading"
              className={styles.briefing}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Topbar />
              <PopCard className={styles.briefingCard}>
                <BoltIcon />
                <p>Preparando tu ascenso…</p>
              </PopCard>
            </motion.div>
          ) : null}
          {session.phase === "intro" || session.phase === "confirm" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Intro
                challenge={sliceChallenge}
                storageAvailable={session.storageAvailable}
                confirming={session.phase === "confirm"}
                onConfirm={session.showConfirmation}
                onCancel={session.hideConfirmation}
                onStart={session.start}
              />
            </motion.div>
          ) : null}
          {session.phase === "briefing" ? (
            <motion.div
              key="briefing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <Briefing level={currentLevel} onStart={session.beginLevel} />
            </motion.div>
          ) : null}
          {session.phase === "playing" ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
            >
              <Question
                question={question}
                deadlineAt={session.deadlineAt}
                onReady={session.armCurrentLevel}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
              />
            </motion.div>
          ) : null}
          {session.phase === "transition" && session.latestResult ? (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Feedback result={session.latestResult} question={question} />
            </motion.div>
          ) : null}
          {session.phase === "results" && result ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Result result={result} onReview={session.showReview} />
            </motion.div>
          ) : null}
          {session.phase === "review" && session.latestResult ? (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Review
                result={session.latestResult}
                question={question}
                onBack={session.showResults}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </PopCanvas>
    </MotionConfig>
  );
}
