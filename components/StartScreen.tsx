import Link from "next/link";
import { ArrowIcon, ClockIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import styles from "@/components/StartScreen.module.css";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import type { StageSummary } from "@/types/game";

export function StartScreen({ stages }: { stages: StageSummary[] }) {
  return (
    <section
      className={`${styles.homeEntrance} relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-10`}
    >
      <AppHeader
        left={<Logo />}
        right={
          <Badge variant="status" dot>
            Demo en solitario
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col justify-center py-10 sm:py-12">
        <div className="relative z-10">
          <div
            className={`${styles.eyebrowEntrance} mb-6 inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.18em] text-[var(--electric)] uppercase`}
          >
            <span className="h-px w-8 bg-[var(--electric)]" />
            Tu sprint empieza aquí
          </div>

          <h1 className={`${styles.heroTitle} ${styles.titleEntrance}`}>
            <span>PIENSA.</span>
            <span>RESPONDE.</span>
            <span className={styles.heroTitleAccent}>VUELA.</span>
          </h1>

          <p
            className={`${styles.copyEntrance} mt-6 max-w-xl text-base leading-7 text-white/55 sm:text-lg`}
          >
            Elige tu sprint. Diez preguntas, poco tiempo y cero excusas para quedarte quieto.
          </p>
        </div>

        <div className={`${styles.stageSelector} ${styles.stageSelectorEntrance} mt-9`}>
          {stages.map((stage) => (
            <Link key={stage.id} className={styles.stageSelectCard} href={`/etapas/${stage.id}`}>
              <span className={styles.stageSelectNumber}>
                {String(stage.number).padStart(2, "0")}
              </span>
              <span className={styles.stageSelectContent}>
                <span className="flex w-full items-center justify-between gap-3">
                  <Badge>Etapa {String(stage.number).padStart(2, "0")}</Badge>
                  <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-white/35 uppercase">
                    {stage.questionCount} retos
                  </span>
                </span>
                <strong>{stage.title}</strong>
                <span className={styles.stageSelectSubtitle}>{stage.subtitle}</span>
                <span className={styles.stageSelectAction}>
                  Jugar etapa <ArrowIcon className="h-4 w-4" />
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className={styles.libraryEntrance}>
          <Link className={styles.libraryCard} href="/formatos">
            <span>
              <small>Manual de juego</small>
              <strong>Biblioteca de formatos</strong>
              <p>
                Descubre las reglas, la puntuación y las mejores prácticas de los nueve tipos de
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
          Cada sprint dura menos de 3 minutos
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-white/8 pt-4 font-mono text-[10px] font-bold tracking-[0.16em] text-white/25 uppercase">
        <span>Velocidad + precisión</span>
        <span>Versión 02</span>
      </footer>
    </section>
  );
}
