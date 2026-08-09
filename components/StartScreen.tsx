import Link from "next/link";
import { ArrowIcon, ClockIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import styles from "@/components/StartScreen.module.css";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import type { ChallengeSummary, SeasonStatus } from "@/types/game";

type StartScreenProps = {
  roomTitle: string;
  seasonTitle: string;
  seasonStatus: SeasonStatus;
  challenges: ChallengeSummary[];
};

function formatSeasonStatus(status: SeasonStatus) {
  return status === "active" ? "Activa" : "Finalizada";
}

function formatChallengeDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

function getChallengeStatusLabel(challenge: ChallengeSummary) {
  if (!challenge.playable && challenge.availabilityStatus === "available") return "Próximamente";
  if (
    challenge.availabilityStatus === "available" &&
    challenge.implementationStatus === "prototype"
  ) {
    return "Vista previa";
  }
  if (challenge.availabilityStatus === "available") return "Disponible";
  if (challenge.availabilityStatus === "expired") return "Cerrado";
  return "Próximamente";
}

function getChallengeDateLabel(challenge: ChallengeSummary) {
  if (challenge.availabilityStatus === "expired") {
    return `Cerrado el ${formatChallengeDate(challenge.availableUntil)}`;
  }
  if (challenge.availabilityStatus === "available") {
    return `Disponible hasta ${formatChallengeDate(challenge.availableUntil)}`;
  }
  return `Abre el ${formatChallengeDate(challenge.availableFrom)}`;
}

function getChallengeCountLabel(challenge: ChallengeSummary) {
  if (challenge.questionCount <= 0) return "Sin abrir";
  if (challenge.mode === "alphabet") return `${challenge.questionCount} letras · Alfabeto`;
  if (challenge.mode === "survival") return `${challenge.questionCount} retos · Supervivencia`;
  if (challenge.mode === "narrative") return `${challenge.questionCount} pruebas · Narrativa`;
  return `${challenge.questionCount} retos · Flash`;
}

function getChallengeActionLabel(challenge: ChallengeSummary) {
  if (!challenge.playable) return "Bloqueado";
  if (challenge.mode === "alphabet") return "Jugar Alfabeto";
  if (challenge.mode === "survival") return "Jugar Supervivencia";
  if (challenge.mode === "narrative") return "Probar movimiento I";
  return "Jugar Flash";
}

export function StartScreen({
  roomTitle,
  seasonTitle,
  seasonStatus,
  challenges,
}: StartScreenProps) {
  return (
    <section
      className={`${styles.homeEntrance} relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-10`}
    >
      <AppHeader
        left={<Logo />}
        right={
          <Badge variant="status" dot>
            {formatSeasonStatus(seasonStatus)}
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col justify-center py-10 sm:py-12">
        <div className="relative z-10">
          <div
            className={`${styles.eyebrowEntrance} mb-6 inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.18em] text-[var(--electric)] uppercase`}
          >
            <span className="h-px w-8 bg-[var(--electric)]" />
            Tu próximo desafío
          </div>

          <h1 className={`${styles.heroTitle} ${styles.titleEntrance}`}>
            <span>PIENSA.</span>
            <span>RESPONDE.</span>
            <span className={styles.heroTitleAccent}>SUPERA.</span>
          </h1>

          <p
            className={`${styles.copyEntrance} mt-6 max-w-xl text-base leading-7 text-white/55 sm:text-lg`}
          >
            Cada desafío propone una forma distinta de jugar. Elige el que esté disponible y
            demuestra hasta dónde puedes llegar.
          </p>
          <p className="mt-4 font-mono text-[11px] font-bold tracking-[0.14em] text-white/35 uppercase">
            {roomTitle} · {seasonTitle}
          </p>
        </div>

        <div className={`${styles.stageSelector} ${styles.stageSelectorEntrance} mt-9`}>
          {challenges.map((challenge) => {
            const cardContent = (
              <>
                <span className={styles.stageSelectNumber}>
                  {String(challenge.number).padStart(2, "0")}
                </span>
                <span className={styles.stageSelectContent}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <Badge>{getChallengeStatusLabel(challenge)}</Badge>
                    <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-white/35 uppercase">
                      {getChallengeCountLabel(challenge)}
                    </span>
                  </span>
                  <strong>{challenge.title}</strong>
                  <span className={styles.stageSelectSubtitle}>{challenge.subtitle}</span>
                  <span className={styles.stageSelectDate}>
                    <ClockIcon className="h-4 w-4" />
                    {getChallengeDateLabel(challenge)}
                  </span>
                  <span className={styles.stageSelectAction}>
                    {getChallengeActionLabel(challenge)}
                    {challenge.playable && <ArrowIcon className="h-4 w-4" />}
                  </span>
                </span>
              </>
            );

            return challenge.playable ? (
              <Link
                key={challenge.id}
                className={styles.stageSelectCard}
                href={`/desafios/${challenge.id}`}
              >
                {cardContent}
              </Link>
            ) : (
              <div
                key={challenge.id}
                className={`${styles.stageSelectCard} ${styles.stageSelectCardDisabled}`}
                aria-disabled="true"
              >
                {cardContent}
              </div>
            );
          })}
        </div>

        <div className={styles.libraryEntrance}>
          <Link className={styles.libraryCard} href="/formatos">
            <span>
              <small>Manual de juego</small>
              <strong>Biblioteca de formatos</strong>
              <p>
                Descubre las reglas, la puntuación y las mejores prácticas de los formatos de
                pregunta.
              </p>
            </span>
            <span className={styles.libraryAction}>
              Explorar formatos <ArrowIcon className="h-5 w-5" />
            </span>
          </Link>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm text-white/40">
          <ClockIcon className="h-4 w-4" />
          Cada desafío dura menos de 3 minutos
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-white/8 pt-4 font-mono text-[10px] font-bold tracking-[0.16em] text-white/25 uppercase">
        <span>Precisión + estrategia</span>
        <span>Versión 02</span>
      </footer>
    </section>
  );
}
