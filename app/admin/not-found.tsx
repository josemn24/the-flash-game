import { ButtonLink } from "@/components/ui";

export default function AdminNotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--color-canvas)] px-5 text-center text-[var(--color-ink)]">
      <div>
        <p className="font-mono text-xs font-black tracking-[.2em] text-[var(--color-danger)] uppercase">
          Acceso no disponible
        </p>
        <h1 className="type-display-strong mt-3 text-5xl uppercase sm:text-7xl">Fuera de pista</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[var(--color-ink-muted)]">
          Esta superficie privada no está disponible para esta cuenta.
        </p>
        <ButtonLink className="mt-7" href="/">
          Volver al inicio
        </ButtonLink>
      </div>
    </main>
  );
}
