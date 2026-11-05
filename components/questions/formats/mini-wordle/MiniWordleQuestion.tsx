"use client";

import { MotionButton } from "@/components/ui";
import {
  usePracticeMiniWordle,
  type PracticeMiniWordleOptions,
} from "@/features/question-formats/formats/mini-wordle/usePracticeMiniWordle";
import { MiniWordleView } from "./MiniWordleView";
import styles from "./MiniWordleQuestion.module.css";

type Props = PracticeMiniWordleOptions & { className?: string };

export function MiniWordleQuestion(props: Props) {
  const session = usePracticeMiniWordle(props);
  return (
    <MiniWordleView
      rows={session.rows}
      wordLength={session.wordLength}
      maxAttempts={session.maxAttempts}
      attemptsUsed={session.attemptsUsed}
      hint={props.hint}
      className={props.className}
      value={session.value}
      disabled={!session.canSubmit}
      onValueChange={session.changeValue}
      onSubmit={session.submit}
      animateSubmit
      beforeInput={
        <>
          {!session.dictionaryReady && !session.dictionaryError ? (
            <p className={styles.dictionaryStatus} role="status">
              Cargando diccionario…
            </p>
          ) : null}
          {session.dictionaryError ? (
            <div className={styles.dictionaryError} role="alert">
              <span>No se pudo cargar el diccionario.</span>
              <MotionButton type="button" variant="secondary" onClick={session.retryDictionary}>
                Reintentar
              </MotionButton>
            </div>
          ) : null}
        </>
      }
      metaMessage={
        <span className={styles.error} role="status" aria-live="polite">
          {session.error}
        </span>
      }
    />
  );
}
