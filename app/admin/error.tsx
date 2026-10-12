"use client";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
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
          No hemos podido conectar con el servicio. Inténtalo de nuevo en unos segundos.
        </p>
        <button
          className="mt-7 rounded-[var(--radius-control)] border-2 border-[var(--ds-color-border-ink)] bg-[var(--ds-color-bg-brand)] px-5 py-3 font-mono text-xs font-black uppercase shadow-[var(--shadow-control)]"
          type="button"
          onClick={unstable_retry}
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
