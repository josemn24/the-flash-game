"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import { ArrowIcon, Button, Card, CheckIcon, CrossIcon, RotateIcon, Timer } from "@/components/ui";
import { ChallengeIntro, ChallengeResultScreen, StartCountdown } from "@/components/game/shared";
import { useServerAlphabetSession } from "@/features/game/useServerAlphabetSession";
import type { GameRoomContext } from "@/types/game";
import type { ServerAlphabetChallenge, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import styles from "./FlashPopAlphabetGame.module.css";

function statusLabel(status: string) {
  if (status === "correct") return "Correcta";
  if (status === "incorrect") return "Incorrecta";
  if (status === "passed") return "Pasada";
  if (status === "unanswered") return "Sin responder";
  if (status === "active") return "Activa";
  return "Sin visitar";
}

function AlphabetBoard({
  letters,
}: {
  letters: readonly { letter: string; status: string }[];
}) {
  return (
    <div className={`${styles.board} ${styles.boardCompact}`} role="list" aria-label="Estado de las letras">
      {letters.map((item, index) => (
        <div
          key={item.letter}
          className={`${styles.letterCell} ${styles[`status_${item.status}`] ?? ""}`}
          style={{ "--letter-index": index, "--letter-count": letters.length } as CSSProperties}
          role="listitem"
          aria-label={`${item.letter}: ${statusLabel(item.status)}`}
        >
          <span>{item.letter}</span>
          {item.status === "correct" ? <CheckIcon className={styles.markIcon} /> : null}
          {item.status === "incorrect" ? <CrossIcon className={styles.markIcon} /> : null}
          {item.status === "passed" ? <span className={styles.passMark}>↻</span> : null}
        </div>
      ))}
    </div>
  );
}

function AlphabetAnswerForm({
  question,
  locked,
  busy,
  onSubmit,
  onPass,
}: {
  question: NonNullable<ReturnType<typeof useServerAlphabetSession>["question"]>;
  locked: boolean;
  busy: boolean;
  onSubmit: (answer: string) => void;
  onPass: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (answer.trim()) void onSubmit(answer);
  };

  return (
    <form className={styles.answerForm} onSubmit={submit}>
      <label htmlFor="server-alphabet-answer">Tu respuesta</label>
      <input
        id="server-alphabet-answer"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={locked || busy}
        placeholder={question.answerPlaceholder ?? "Escribe tu respuesta…"}
        autoComplete="off"
      />
      <div className={styles.answerActions}>
        <Button variant="secondary" type="button" className={styles.passButton} onClick={onPass} disabled={locked || busy} trailingIcon={<RotateIcon />}>Pasar</Button>
        <Button type="submit" disabled={locked || busy || !answer.trim()} trailingIcon={<ArrowIcon />}>Responder</Button>
      </div>
    </form>
  );
}

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

  if (session.phase === "intro") {
    return (
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
    );
  }
  if (session.phase === "recovering") {
    return <Card className="mx-auto mt-12 max-w-xl"><h1>Recuperando partida</h1><p>Comprobamos el estado seguro de tu intento.</p></Card>;
  }
  if (session.phase === "countdown") {
    return <StartCountdown label="Alfabeto" onComplete={session.startQuestions} />;
  }
  if (session.phase === "results") {
    const correct = session.results.filter((result) => result.isCorrect).length;
    return (
      <ChallengeResultScreen
        model={{
          gameTitle: "Alfabeto",
          statusLabel: "Completado",
          eyebrow: "Desafío completado",
          title: correct === challenge.entries.length ? "Alfabeto dominado" : "Buen recorrido",
          score: session.score,
          maxScore: challenge.maxScore,
          scoreUnit: "flashPoints",
          accuracy: (correct / challenge.entries.length) * 100,
          totalTime: (session.progress?.elapsedTimeMs ?? 0) / 1000,
          metrics: [
            { label: "Aciertos", value: correct, tone: "success" },
            { label: "Errores", value: session.results.filter((result) => !result.isCorrect).length, tone: "danger" },
            { label: "Letras", value: challenge.entries.length },
          ],
        }}
        onReview={session.showReview}
        returnTo={roomContext.returnTo}
      />
    );
  }
  if (session.phase === "review" && session.reviewChallenge) {
    return (
      <div className={styles.stage}>
        <h1>Revisión del Alfabeto</h1>
        <Button variant="secondary" onClick={session.showResults}>Volver al resultado</Button>
        <div className="mt-6 grid gap-4">
          {session.reviewChallenge.entries.map((entry) => {
            const result = session.results.find((item) => item.questionId === entry.question.id);
            return (
              <Card key={entry.question.id}>
                <strong>{entry.letter}</strong>
                <h2>{entry.question.question}</h2>
                <p>Tu respuesta: {typeof result?.answer === "string" ? result.answer : "Sin respuesta"}</p>
                <p>
                  Solución: {entry.question.type === "short-text" ? entry.question.correctAnswer : "—"}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const progress = session.progress;
  return (
    <div className={styles.playing}>
      <div className={styles.gameMeta}>
        <span>Vuelta {progress?.round ?? 1}</span>
        <span><strong>{progress?.correctAnswers ?? 0}</strong> / {challenge.entries.length}</span>
        <Timer
          duration={challenge.timeLimitMs / 1000}
          active={!session.locked}
          deadlineAt={session.deadlineAt ?? undefined}
          onTimeUp={session.onTimeUp}
          resetKey={challenge.id}
          size="compact"
        />
      </div>
      <div className={styles.playGrid}>
        <Card className={styles.boardCard}>
          <AlphabetBoard letters={progress?.letters ?? challenge.entries.map((entry) => ({ letter: entry.letter, status: "unvisited" }))} />
        </Card>
        <section className={styles.questionPanel} aria-labelledby="server-alphabet-question">
          <p>Letra {session.question?.letter}</p>
          <h1 id="server-alphabet-question">{session.question?.question ?? "Preparando…"}</h1>
          {session.question ? (
            <AlphabetAnswerForm
              key={session.question.id}
              question={session.question}
              locked={session.locked}
              busy={session.busy}
              onSubmit={session.submit}
              onPass={session.pass}
            />
          ) : null}
          {session.error ? <p role="alert">{session.error}</p> : null}
          {session.lastResult ? <p role="status">{session.lastResult.isCorrect ? "Correcto" : "Respuesta registrada"}</p> : null}
        </section>
      </div>
    </div>
  );
}
