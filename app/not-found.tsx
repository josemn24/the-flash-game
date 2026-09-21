import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[var(--color-canvas)] px-5 text-center text-[var(--color-ink)]">
      <div className="relative z-10">
        <p className="font-mono text-xs font-black tracking-[.2em] text-[var(--color-danger)] uppercase">
          Error 404
        </p>
        <h1 className="type-display-strong mt-3 text-5xl uppercase sm:text-7xl">
          Ruta fuera de pista
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[var(--color-ink-muted)]">
          El desafío o el formato que buscas no existe en esta versión.
        </p>
        <ButtonLink className="mt-7" href="/">
          Volver al inicio
        </ButtonLink>
      </div>
    </main>
  );
}
