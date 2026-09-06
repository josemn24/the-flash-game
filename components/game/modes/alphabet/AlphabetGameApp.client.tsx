"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowIcon,
  BoltIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  EyeIcon,
  RotateIcon,
} from "@/components/ui";
import { Button, Timer } from "@/components/ui";
import type { AlphabetLetterState, AlphabetLetterStatus } from "@/features/alphabet/alphabetGame";
import { useAlphabetSession } from "@/features/alphabet/useAlphabetSession";
import type { AlphabetChallenge, ShortTextQuestion } from "@/types/game";
import styles from "./AlphabetGameApp.module.css";

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
  return `${minutes}:${String(rest).padStart(2, "0")}`;
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
            } as React.CSSProperties
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

function AlphabetTopbar({
  right,
  challengeTitle,
}: {
  right?: React.ReactNode;
  challengeTitle?: string;
}) {
  return (
    <header className={styles.topbar}>
      <Link className={styles.headerChallengeLink} href="/" aria-label="Volver a los desafíos">
        <span className={styles.headerMark}>
          <BoltIcon className="h-3.5 w-3.5" />
        </span>
        <span>{challengeTitle ?? "The Flash"}</span>
      </Link>
      <div className={styles.topbarRight}>{right}</div>
    </header>
  );
}

function Intro({ challenge, onStart }: { challenge: AlphabetChallenge; onStart: () => void }) {
  const letterCount = challenge.entries.length;
  const previewLetters = challenge.entries.map((entry) => ({
    letter: entry.letter,
    questionId: entry.question.id,
    status: "unvisited" as const,
    answer: null,
  }));

  return (
    <motion.section
      className={styles.screen}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
    >
      <AlphabetTopbar challengeTitle={challenge.title} />
      <div className={styles.introGrid}>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>Desafío {String(challenge.number).padStart(2, "0")}</p>
          <h1>{challenge.title}</h1>
          <p className={styles.subtitle}>{challenge.subtitle}</p>
          <p className={styles.description}>{challenge.description}</p>

          <div className={styles.introStats}>
            <div>
              <strong>{letterCount}</strong>
              <span>Letras</span>
            </div>
            <div>
              <strong>100</strong>
              <span>Puntos</span>
            </div>
            <div>
              <strong>{challenge.timeLimit}</strong>
              <span>Segundos</span>
            </div>
          </div>

          <div className={styles.rules}>
            <div>
              <span>01</span>
              <p>
                <strong>Responde</strong> un animal que empiece por la letra activa.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Pasa</strong> si necesitas pensarlo: volverá en la siguiente vuelta.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Acierta más.</strong> En empate, cuenta cuándo lograste tu último acierto.
              </p>
            </div>
          </div>

          <Button size="hero" onClick={onStart}>
            Comenzar desafío
            <ArrowIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className={styles.introBoard}>
          <div className={styles.boardCenter}>
            <span>Modo</span>
            <strong>Alfabeto</strong>
            <small>{letterCount} letras</small>
          </div>
          <AlphabetBoard letters={previewLetters} />
        </div>
      </div>
    </motion.section>
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
    <motion.section
      className={styles.countdown}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="assertive"
    >
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
      <span>El tiempo empieza después de la cuenta atrás</span>
    </motion.section>
  );
}

function RoundNotice({ round, remaining }: { round: number; remaining: number }) {
  const [visible, setVisible] = useState(round > 1);

  useEffect(() => {
    if (round <= 1) return;
    const timeout = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timeout);
  }, [round]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.roundNotice}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="status"
        >
          Vuelta {round} · Quedan {remaining} letras
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QuestionForm({
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

  useEffect(() => inputRef.current?.focus(), []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (answer.trim() && !locked) onSubmit(answer);
  };

  return (
    <form className={styles.answerForm} onSubmit={submit}>
      <label htmlFor={`alphabet-answer-${question.id}`}>Tu respuesta</label>
      <input
        ref={inputRef}
        id={`alphabet-answer-${question.id}`}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={locked}
        autoComplete="off"
        enterKeyHint="send"
        placeholder="Escribe el animal…"
      />
      <div className={styles.answerActions}>
        <button className={styles.passButton} type="button" onClick={onPass} disabled={locked}>
          Pasar
          <span aria-hidden="true">↻</span>
        </button>
        <button className={styles.submitButton} type="submit" disabled={locked || !answer.trim()}>
          Responder
          <ArrowIcon className="h-5 w-5" />
        </button>
      </div>
      <p>No importan las mayúsculas ni las tildes. Se admite una letra final repetida.</p>
    </form>
  );
}

type GameSession = ReturnType<typeof useAlphabetSession>;

function Playing({ challenge, session }: { challenge: AlphabetChallenge; session: GameSession }) {
  const entry = session.activeEntry;
  if (!entry || entry.question.type !== "short-text") return null;
  const remaining = session.letters.filter((letter) =>
    ["unvisited", "active", "passed"].includes(letter.status),
  ).length;
  const locked = session.phase === "feedback";

  return (
    <motion.section
      className={styles.screen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AlphabetTopbar
        challengeTitle={challenge.title}
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

      <RoundNotice key={session.round} round={session.round} remaining={remaining} />

      <div className={styles.playGrid}>
        <div className={styles.gameBoardCard}>
          <AlphabetBoard letters={session.letters} compact />
        </div>

        <div className={styles.questionPanel}>
          <div className={styles.questionHeading}>
            <p>Empieza por {entry.letter}</p>
            <span>{entry.question.category}</span>
          </div>
          <h1>{entry.question.question}</h1>

          <QuestionForm
            key={`${entry.question.id}-${session.round}`}
            question={entry.question}
            locked={locked}
            onSubmit={session.submitAnswer}
            onPass={session.pass}
          />

          <div className={styles.feedback} aria-live="assertive" aria-atomic="true">
            <AnimatePresence>
              {session.feedback && (
                <motion.div
                  className={
                    session.feedback === "correct"
                      ? styles.feedbackCorrect
                      : styles.feedbackIncorrect
                  }
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {session.feedback === "correct" ? (
                    <CheckIcon className="h-5 w-5" />
                  ) : (
                    <CrossIcon className="h-5 w-5" />
                  )}
                  {session.feedback === "correct" ? "Correcto" : "Respuesta incorrecta"}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Results({ challenge, session }: { challenge: AlphabetChallenge; session: GameSession }) {
  return (
    <motion.section
      className={styles.screen}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <AlphabetTopbar
        challengeTitle={challenge.title}
        right={<span className={styles.completeBadge}>Completado</span>}
      />
      <div className={styles.resultsGrid}>
        <div className={styles.scoreCard}>
          <p className={styles.eyebrow}>Desafío completado</p>
          <h1>
            {session.correctAnswers >= 12
              ? "Alfabeto dominado."
              : session.correctAnswers >= 8
                ? "Buen recorrido."
                : "Aún quedan letras por conquistar."}
          </h1>
          <div className={styles.score}>
            <strong>{session.score}</strong>
            <span>/ 100 puntos</span>
          </div>
          <p className={styles.scoreSummary}>
            Has resuelto <strong>{session.correctAnswers}</strong> de {challenge.entries.length}{" "}
            letras.
          </p>

          <div className={styles.resultActions}>
            <Button onClick={session.replay}>
              <RotateIcon className="h-5 w-5" />
              Volver a jugar
            </Button>
            <Button variant="secondary" onClick={session.showReview}>
              <EyeIcon className="h-5 w-5" />
              Revisar respuestas
            </Button>
            <Link className={styles.homeAction} href="/">
              Volver a desafíos
            </Link>
          </div>
        </div>

        <div className={styles.resultDetails}>
          <AlphabetBoard letters={session.letters} compact />
          <div className={styles.metricGrid}>
            <div className={styles.metricCorrect}>
              <CheckIcon className="h-5 w-5" />
              <strong>{session.correctAnswers}</strong>
              <span>Correctas</span>
            </div>
            <div className={styles.metricIncorrect}>
              <CrossIcon className="h-5 w-5" />
              <strong>{session.incorrectAnswers}</strong>
              <span>Incorrectas</span>
            </div>
            <div>
              <span className={styles.metricDash}>—</span>
              <strong>{session.unanswered}</strong>
              <span>Sin responder</span>
            </div>
          </div>
          <div className={styles.timeDetails}>
            <div>
              <ClockIcon className="h-5 w-5" />
              <span>Duración total</span>
              <strong>{formatTime(session.elapsedTime)}</strong>
            </div>
            <div>
              <ClockIcon className="h-5 w-5" />
              <span>Tiempo de desempate</span>
              <strong>
                {session.lastCorrectAt === null
                  ? "Sin aciertos"
                  : formatTime(session.lastCorrectAt)}
              </strong>
            </div>
            <div>
              <span className={styles.roundMetric}>↻</span>
              <span>Vueltas</span>
              <strong>{session.round}</strong>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Review({ challenge, session }: { challenge: AlphabetChallenge; session: GameSession }) {
  return (
    <motion.section
      className={styles.screen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AlphabetTopbar
        challengeTitle={challenge.title}
        right={
          <button className={styles.resultsBack} type="button" onClick={session.showResults}>
            Resultados
          </button>
        }
      />
      <div className={styles.reviewHeader}>
        <p className={styles.eyebrow}>Revisión</p>
        <h1>Letra por letra</h1>
        <p>Consulta tu respuesta, la solución aceptada y el dato que resolvía cada definición.</p>
      </div>
      <div className={styles.reviewList}>
        {challenge.entries.map((entry, index) => {
          const result = session.letters[index];
          if (!result || entry.question.type !== "short-text") return null;
          return (
            <article key={entry.letter} className={styles.reviewCard}>
              <div
                className={`${styles.reviewLetter} ${styles[`status_${result.status}`]}`}
                aria-label={`${entry.letter}: ${STATUS_LABELS[result.status]}`}
              >
                {entry.letter}
              </div>
              <div>
                <p className={styles.reviewClue}>
                  <span>Empieza por {entry.letter}</span>
                  {entry.question.question}
                </p>
                <div className={styles.reviewAnswers}>
                  <p>
                    <span>Tu respuesta</span>
                    <strong>{result.answer ?? "Sin responder"}</strong>
                  </p>
                  <p>
                    <span>Solución</span>
                    <strong>{entry.question.correctAnswer}</strong>
                  </p>
                </div>
                <p className={styles.explanation}>{entry.question.explanation}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className={styles.reviewFooter}>
        <Button variant="secondary" onClick={session.showResults}>
          Volver a resultados
        </Button>
        <Button onClick={session.replay}>
          <RotateIcon className="h-5 w-5" />
          Volver a jugar
        </Button>
      </div>
    </motion.section>
  );
}

export function AlphabetGameApp({ challenge }: { challenge: AlphabetChallenge }) {
  const session = useAlphabetSession(challenge);

  return (
    <MotionConfig reducedMotion="user">
      <main className={styles.shell}>
        <div className={styles.ambientGrid} aria-hidden="true" />
        <AnimatePresence mode="wait">
          {session.phase === "intro" && (
            <Intro key="intro" challenge={challenge} onStart={session.beginCountdown} />
          )}
          {session.phase === "countdown" && (
            <Countdown key="countdown" onComplete={session.start} />
          )}
          {(session.phase === "playing" || session.phase === "feedback") && (
            <Playing key="playing" challenge={challenge} session={session} />
          )}
          {session.phase === "results" && (
            <Results key="results" challenge={challenge} session={session} />
          )}
          {session.phase === "review" && (
            <Review key="review" challenge={challenge} session={session} />
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
