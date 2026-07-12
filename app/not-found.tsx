import Link from "next/link";
import { SpeedBackground } from "@/components/SpeedBackground";

export default function NotFound() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[var(--ink)] px-5 text-center text-white">
      <SpeedBackground />
      <div className="relative z-10">
        <p className="font-mono text-xs font-black tracking-[.2em] text-[var(--coral)] uppercase">
          Error 404
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-5xl font-black tracking-[-.06em] uppercase sm:text-7xl">
          Ruta fuera de pista
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-white/45">
          La etapa o el formato que buscas no existe en esta versión.
        </p>
        <Link
          className="mt-7 inline-flex rounded-full bg-[var(--electric)] px-6 py-3 text-sm font-black text-black"
          href="/"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
