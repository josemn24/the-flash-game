"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowIcon, BoltIcon, CheckIcon, CrossIcon, EyeIcon, RotateIcon } from "@/components/ui";
import { Avatar, Button, ButtonLink, Card, Canvas, Chip, GameHeader, Timer } from "@/components/ui";
import type { AlphabetLetterState, AlphabetLetterStatus } from "@/features/alphabet/alphabetGame";
import { useAlphabetSession } from "@/features/alphabet/useAlphabetSession";
import { buildAlphabetAnswerReviews } from "@/features/alphabet/alphabetReview";
import {
  getFlashPopAlphabetResult,
  type FlashPopAlphabetSummary,
} from "@/features/flash-pop/alphabetSocial";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ReviewAnswerPanel } from "@/components/game/shared";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type {
  AlphabetChallenge,
  AnswerStatus,
  ChallengeCompletionResult,
  GameRoomContext,
  ShortTextQuestion,
} from "@/types/game";
import styles from "./FlashPopAlphabetGame.module.css";

const STATUS_LABELS: Record<AlphabetLetterStatus, string> = {
  unvisited: "Sin visitar",
  active: "Activa",
  passed: "Pasada",
  correct: "Correcta",
  incorrect: "Incorrecta",
  unanswered: "Sin responder",
};

function formatTime(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}

function AlphabetMark({ status }: { status: AlphabetLetterStatus }) {
  if (status === "correct") return <CheckIcon className={styles.markIcon} />;
  if (status === "incorrect") return <CrossIcon className={styles.markIcon} />;
  if (status === "passed") return <span className={styles.passMark}>↻</span>;
  if (status === "unanswered") return <span className={styles.emptyMark}>—</span>;
  return null;
}

function AlphabetBoard({
  letters,
  compact = false,
}: {
  letters: AlphabetLetterState[];
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.board} ${compact ? styles.boardCompact : ""}`}
      role="list"
      aria-label="Estado de las letras"
    >
      {letters.map((item, index) => (
        <div
          key={item.letter}
          className={`${styles.letterCell} ${styles[`status_${item.status}`]}`}
          style={
            {
              "--letter-index": index,
              "--letter-count": letters.length,
            } as CSSProperties
          }
          role="listitem"
          aria-label={`${item.letter}: ${STATUS_LABELS[item.status]}`}
        >
          <span>{item.letter}</span>
          <AlphabetMark status={item.status} />
        </div>
      ))}
    </div>
  );
}

function AlphabetForm({
  question,
  locked,
  onSubmit,
  onPass,
}: {
  question: ShortTextQuestion;
  locked: boolean;
  onSubmit: (answer: string) => void;
  onPass: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (answer.trim() && !locked) onSubmit(answer);
  };

  return (
    <form className={styles.answerForm} onSubmit={submit}>
      <label htmlFor={`flash-pop-alphabet-answer-${question.id}`}>Tu respuesta</label>
      <input
        ref={inputRef}
        id={`flash-pop-alphabet-answer-${question.id}`}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={locked}
        autoComplete="off"
        enterKeyHint="send"
        placeholder="Escribe tu respuesta…"
      />
      <div className={styles.answerActions}>
        <Button
          variant="secondary"
          type="button"
          className={styles.passButton}
          onClick={onPass}
          disabled={locked}
          trailingIcon={<RotateIcon />}
        >
          Pasar
        </Button>
        <Button type="submit" disabled={locked || !answer.trim()} trailingIcon={<ArrowIcon />}>
          Responder
        </Button>
      </div>
      <p>No importan las mayúsculas ni las tildes.</p>
    </form>
  );
}

function Intro({ challenge, onStart }: { challenge: AlphabetChallenge; onStart: () => void }) {
  const previewLetters = challenge.entries.map((entry) => ({
    letter: entry.letter,
    questionId: entry.question.id,
    status: "unvisited" as const,
    answer: null,
  }));
  const formats = [
    ...new Set(challenge.entries.map((entry) => QUESTION_FORMAT_LABELS[entry.question.type])),
  ];

  return (
    <div className={styles.stage}>
      <GameHeader title="Alfabeto" />
      <Card as="section" className={styles.introCard} aria-labelledby="alphabet-intro-title">
        <div className={styles.introLayout}>
          <div>
            <Chip tone="social">Reto de hoy · Alfabeto</Chip>
            <h1 id="alphabet-intro-title">{challenge.title}</h1>
            <p className={styles.lead}>{challenge.subtitle}</p>
            <p className={styles.description}>{challenge.description}</p>
            <div className={styles.stats} aria-label="Resumen del desafío">
              <div>
                <strong>{challenge.entries.length}</strong>
                <span>letras</span>
              </div>
              <div>
                <strong>100</strong>
                <span>puntos</span>
              </div>
              <div>
                <strong>{formatTime(challenge.timeLimit)}</strong>
                <span>tiempo máximo</span>
              </div>
            </div>
            <div className={styles.rules}>
              <p>
                <strong>Responde</strong> con una palabra que empiece por la letra activa.
              </p>
              <p>
                <strong>Pasa</strong> si necesitas pensarlo: la letra volverá en otra vuelta.
              </p>
              <p>
                <strong>Desempate:</strong> más aciertos y después el último acierto más rápido.
              </p>
            </div>
            <Button size="hero" fullWidth onClick={onStart} trailingIcon={<ArrowIcon />}>
              Comenzar desafío
            </Button>
          </div>
          <div className={styles.introBoard}>
            <div className={styles.boardCenter} aria-hidden="true">
              <BoltIcon />
              <span>Modo</span>
              <strong>Alfabeto</strong>
              <small>{challenge.entries.length} letras</small>
            </div>
            <AlphabetBoard letters={previewLetters} />
          </div>
        </div>
        <div className={styles.formatList} aria-label="Formatos incluidos">
          {formats.map((format) => (
            <Chip key={format} variant="data">
              {format}
            </Chip>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Countdown({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (count === 1) onComplete();
      else setCount((value) => value - 1);
    }, 750);
    return () => clearTimeout(timeout);
  }, [count, onComplete]);

  return (
    <motion.div
      className={styles.countdown}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="assertive"
    >
      <Chip tone="social" className={styles.countdownChip}>
        Alfabeto
      </Chip>
      <p>Prepárate</p>
      <AnimatePresence mode="popLayout">
        <motion.strong
          key={count}
          initial={{ opacity: 0, scale: 0.55 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.35 }}
        >
          {count}
        </motion.strong>
      </AnimatePresence>
      <span className={styles.countdownHint}>El tiempo empieza después de la cuenta atrás</span>
    </motion.div>
  );
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

  return (
    <div className={styles.playing}>
      <GameHeader
        title="Alfabeto"
        mobileLabel={`Vuelta ${session.round}`}
        right={
          <div className={styles.gameMeta}>
            <span>Vuelta {session.round}</span>
            <span>
              <strong>{session.correctAnswers}</strong> / {challenge.entries.length}
            </span>
            <Timer
              duration={challenge.timeLimit}
              active
              onTimeUp={session.finish}
              resetKey={`${challenge.id}-alphabet`}
              size="compact"
            />
          </div>
        }
      />
      <div className={styles.playGrid}>
        <Card className={styles.boardCard}>
          <AlphabetBoard letters={session.letters} compact />
        </Card>
        <section className={styles.questionPanel} aria-labelledby="alphabet-question-title">
          <h1 id="alphabet-question-title">{entry.question.question}</h1>
          <AlphabetForm
            key={entry.question.id}
            question={entry.question}
            locked={locked}
            onSubmit={session.submitAnswer}
            onPass={session.pass}
          />
          {session.phase === "feedback" ? <Feedback session={session} /> : null}
        </section>
      </div>
    </div>
  );
}

function Feedback({ session }: { session: AlphabetSession }) {
  const correct = session.feedback === "correct";
  return (
    <div className={styles.inlineFeedback}>
      <FlashPopFeedback
        status={correct ? "correct" : "incorrect"}
        variant="inline"
        eyebrow={`Vuelta ${session.round} · ${session.correctAnswers} aciertos`}
        title={correct ? "Correcto" : "Casi."}
        body={
          correct
            ? "La letra queda resuelta. Siguiente en marcha."
            : "La letra queda marcada. Puedes recuperarla en otra vuelta."
        }
      />
    </div>
  );
}

function summaryFor(
  challenge: AlphabetChallenge,
  session: AlphabetSession,
): FlashPopAlphabetSummary {
  return {
    challengeId: challenge.id,
    score: session.score,
    correctAnswers: session.correctAnswers,
    totalLetters: challenge.entries.length,
    elapsedTime: session.elapsedTime,
    lastCorrectAt: session.lastCorrectAt,
  };
}

function Results({
  challenge,
  session,
  roomContext,
  returnTo,
}: {
  challenge: AlphabetChallenge;
  session: AlphabetSession;
  roomContext?: GameRoomContext;
  returnTo: string;
}) {
  const summary = summaryFor(challenge, session);
  const result = getFlashPopAlphabetResult(summary, { timeLimit: challenge.timeLimit });
  return (
    <div className={styles.stage}>
      <GameHeader title="Alfabeto" />
      <Card as="section" className={styles.resultCard} aria-labelledby="alphabet-result-title">
        <Chip variant="reward">Resultado · Demo</Chip>
        <p className={styles.resultChallenge}>{challenge.title}</p>
        <h1 id="alphabet-result-title">
          {session.correctAnswers === challenge.entries.length
            ? "Alfabeto dominado"
            : "Buen recorrido"}
        </h1>
        <div className={styles.score}>
          {session.score}
          <small>/ 100</small>
        </div>
        <p className={styles.scoreLabel}>puntos de partida</p>
        <div className={styles.resultStats}>
          <div>
            <strong>
              {session.correctAnswers} / {challenge.entries.length}
            </strong>
            <span>aciertos</span>
          </div>
          <div>
            <strong>{formatTime(session.elapsedTime)}</strong>
            <span>tiempo total</span>
          </div>
          <div>
            <strong>{session.round}</strong>
            <span>vueltas</span>
          </div>
          {!roomContext ? (
            <div>
              <strong>{result.playerRank}.º</strong>
              <span>posición · {result.totalPlayers}</span>
            </div>
          ) : null}
        </div>
        <p className={styles.tieBreak}>
          Último acierto:{" "}
          {session.lastCorrectAt === null ? "sin aciertos" : formatTime(session.lastCorrectAt)}
        </p>
        <p className={styles.xpCallout}>
          +{result.seasonXpEarned} ⚡ · {result.seasonXpCurrent} / {result.nextLevelAt} ⚡
        </p>
        {roomContext ? (
          <p className={styles.xpCallout}>
            Tu resultado se ha guardado en {roomContext.roomTitle}. Consulta la clasificación al
            volver.
          </p>
        ) : (
          <div className={styles.ranking} aria-label="Clasificación demo">
            <h2>
              Tu grupo <span>· Demo</span>
            </h2>
            {result.peers.map((row) => (
              <div
                className={`${styles.rankingRow} ${row.player.id === "javi" ? styles.current : ""}`}
                key={row.player.id}
              >
                <span className={styles.position}>{row.rank}.</span>
                <Avatar
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
        )}
        <ButtonLink href={returnTo} size="hero" fullWidth trailingIcon={<ArrowIcon />}>
          {roomContext ? "Volver a Tabarnia" : "Volver al lobby"}
        </ButtonLink>
        <Button
          variant="secondary"
          fullWidth
          onClick={session.showReview}
          leadingIcon={<EyeIcon />}
        >
          Revisar respuestas
        </Button>
        <Button variant="secondary" fullWidth onClick={session.replay} leadingIcon={<RotateIcon />}>
          Jugar de nuevo
        </Button>
      </Card>
    </div>
  );
}

function Review({
  challenge,
  session,
}: {
  challenge: AlphabetChallenge;
  session: AlphabetSession;
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
    <div className={styles.stage}>
      <GameHeader title="Alfabeto" />
      <ReviewAnswerPanel
        entries={entries}
        countLabel={`${entries.length} respuestas`}
        title="Historial de respuestas"
        description="Consulta tu respuesta, la solución aceptada y la explicación de cada letra."
        onBack={session.showResults}
        onReplay={session.replay}
      />
    </div>
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
  const session = useAlphabetSession(challenge);
  useChallengeCompletionReporter(
    session.phase === "results"
      ? {
          challengeId: challenge.id,
          points: session.score,
          completed: true,
          answers: buildAlphabetAnswerReviews(challenge, session.letters),
        }
      : null,
    onComplete,
  );
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
              <Intro challenge={challenge} onStart={session.beginCountdown} />
            </motion.div>
          ) : null}
          {session.phase === "countdown" ? (
            <Countdown key="countdown" onComplete={session.start} />
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
                roomContext={roomContext}
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
              <Review challenge={challenge} session={session} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
