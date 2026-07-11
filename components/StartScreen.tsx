"use client";

import { motion } from "motion/react";
import { ArrowIcon, BoltIcon, ClockIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function StartScreen({ onPlay }: { onPlay: () => void }) {
  return (
    <motion.section
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <AppHeader
        left={<Logo />}
        right={<Badge variant="status" dot>Demo en solitario</Badge>}
      />

      <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.08fr_.92fr] lg:py-10">
        <div className="relative z-10">
          <motion.div
            className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.18em] text-[var(--electric)] uppercase"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 }}
          >
            <span className="h-px w-8 bg-[var(--electric)]" />
            Tu sprint empieza aquí
          </motion.div>

          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>PIENSA.</span>
            <span>RESPONDE.</span>
            <span className="hero-title-accent">VUELA.</span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-lg text-base leading-7 text-white/55 sm:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            10 preguntas. Poco tiempo. Cero excusas. Juega una etapa demo y responde antes de que se acabe el tiempo.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
          >
            <Button
              size="hero"
              onClick={onPlay}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
            >
              Jugar etapa demo
              <ArrowIcon className="h-5 w-5" />
            </Button>
            <div className="flex items-center justify-center gap-2 px-3 text-sm text-white/40 sm:justify-start">
              <ClockIcon className="h-4 w-4" />
              Menos de 3 minutos
            </div>
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto hidden w-full max-w-md lg:block"
          initial={{ opacity: 0, x: 40, rotate: 2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sprint-card sprint-card-back" />
          <div className="sprint-card">
            <div className="flex items-center justify-between">
              <Badge>Cultura general</Badge>
              <span className="font-mono text-xs font-bold text-white/40">01 / 10</span>
            </div>
            <div className="start-timer-graphic">
              <svg className="start-timer-ring-svg" viewBox="0 0 180 180" aria-hidden="true">
                <circle className="start-timer-track" cx="90" cy="90" r="72" />
                <circle className="start-timer-ring" cx="90" cy="90" r="72" />
              </svg>
              <div className="start-timer-number">10</div>
              <BoltIcon className="absolute -right-3 top-4 h-12 w-12 rotate-12 text-[var(--electric)]" />
            </div>
            <p className="text-center text-sm font-bold tracking-[0.15em] text-white/35 uppercase">El tiempo corre</p>
          </div>
          <div className="floating-score">+100</div>
        </motion.div>
      </div>

      <footer className="flex items-center justify-between border-t border-white/8 pt-4 font-mono text-[10px] font-bold tracking-[0.16em] text-white/25 uppercase">
        <span>Velocidad + precisión</span>
        <span>Versión 01</span>
      </footer>
    </motion.section>
  );
}
