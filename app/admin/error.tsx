"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--color-canvas)] px-5 text-center text-[var(--color-ink)]">
      <div>
        <p className="font-mono text-xs font-black tracking-[.2em] text-[var(--color-danger)] uppercase">
          Error de conexión
        </p>
        <h1 className="type-display-strong mt-3 text-5xl uppercase sm:text-7xl">Reintenta</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[var(--color-ink-muted)]">
          No se ha podido cargar el contexto del portal.
        </p>
        <button
          className="mt-7 rounded-[var(--radius-control)] border-2 border-[var(--color-ink)] bg-[var(--color-brand)] px-5 py-3 font-mono text-xs font-black uppercase shadow-[var(--shadow-control)]"
          type="button"
          onClick={() => reset()}
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
