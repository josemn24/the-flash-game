"use client";

import { ArrowIcon, HeartIcon, RotateIcon } from "@/components/ui";
import { Avatar, Button, ButtonLink, Card, Chip, GameHeader } from "@/components/ui";
import type { FlashPopSurvivalResult } from "@/features/flash-pop/survivalSocial";
import type { AnswerResult, GameRoomContext, SurvivalChallenge } from "@/types/game";
import styles from "./FlashPopSurvivalResult.module.css";

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

export function FlashPopSurvivalResult({
  challenge,
  result,
  results,
  totalTime,
  eliminated,
  onReview,
  onReplay,
  returnTo,
  roomContext,
}: {
  challenge: SurvivalChallenge;
  result: FlashPopSurvivalResult;
  results: AnswerResult[];
  totalTime: number;
  eliminated: boolean;
  onReview: () => void;
  onReplay: () => void;
  returnTo: string;
  roomContext?: GameRoomContext;
}) {
  const correct = results.filter((item) => item.status === "correct").length;
  const partial = results.filter((item) => item.status === "partial").length;
  const mistakes = results.filter(
    (item) => item.status === "incorrect" || item.status === "unanswered",
  ).length;
  const survived = !eliminated && result.questionsReached >= challenge.questions.length;

  return (
    <div className={styles.stage}>
      <GameHeader title="Supervivencia" />
      <Card as="section" className={styles.card} aria-labelledby="survival-result-title">
        <Chip variant={survived ? "reward" : "data"}>
          {survived ? "Supervivencia completada" : "Partida terminada"}
        </Chip>
        <p className={styles.challenge}>{challenge.title}</p>
        <h1 id="survival-result-title">
          {survived ? "Has sobrevivido" : eliminated ? "Sin vidas" : "Buen intento"}
        </h1>
        <p className={styles.subtitle}>
          {survived
            ? `Has completado los ${challenge.questions.length} retos.`
            : `Has llegado al reto ${result.questionsReached} de ${challenge.questions.length}.`}
        </p>

        <div className={styles.score} aria-label={`${result.score} puntos`}>
          {result.score}
        </div>
        <p className={styles.scoreLabel}>puntos de partida</p>

        <div className={styles.stats} aria-label="Resumen de la partida">
          <div>
            <strong>
              {result.questionsReached} / {challenge.questions.length}
            </strong>
            <span>retos alcanzados</span>
          </div>
          <div>
            <strong className={styles.livesValue}>
              <HeartIcon aria-hidden="true" /> {result.livesRemaining}
            </strong>
            <span>vidas restantes</span>
          </div>
          <div>
            <strong>{formatTime(totalTime)}</strong>
            <span>tiempo total</span>
          </div>
          {!roomContext ? (
            <div>
              <strong>{result.playerRank}.º</strong>
              <span>posición · {result.totalPlayers}</span>
            </div>
          ) : null}
        </div>

        <p className={styles.breakdown}>
          {correct} aciertos · {partial} parciales · {mistakes} vidas consumidas
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
                <span className={styles.name}>
                  {row.player.id === "javi" ? "Tú" : row.player.displayName}
                </span>
                <span className={styles.rowScore}>{row.score} pts</span>
              </div>
            ))}
          </div>
        )}

        <ButtonLink href={returnTo} size="hero" fullWidth trailingIcon={<ArrowIcon />}>
          {roomContext ? "Volver a Tabarnia" : "Volver al lobby"}
        </ButtonLink>
        <Button variant="secondary" fullWidth onClick={onReview}>
          Revisar respuestas
        </Button>
        <Button variant="secondary" fullWidth onClick={onReplay} leadingIcon={<RotateIcon />}>
          Jugar de nuevo
        </Button>
      </Card>
    </div>
  );
}
