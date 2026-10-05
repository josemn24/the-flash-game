"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--ds-color-bg-canvas)] px-5 text-center text-[var(--ds-color-fg-primary)]">
      <div>
        <p className="font-mono text-xs font-black tracking-[.2em] text-[var(--ds-color-fg-error)] uppercase">
          Servicio temporalmente no disponible
        </p>
        <h1 className="type-display-strong mt-3 text-5xl uppercase sm:text-7xl">Reintenta</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[var(--ds-color-fg-secondary)]">
          No hemos podido cargar los datos persistidos. Tu partida no se sustituye por datos de
          demostración.
        </p>
        <button
          className="mt-7 rounded-[var(--radius-control)] border-2 border-[var(--ds-color-border-ink)] bg-[var(--ds-color-bg-brand)] px-5 py-3 font-mono text-xs font-black uppercase shadow-[var(--shadow-control)]"
          type="button"
          onClick={() => reset()}
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
