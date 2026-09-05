import Link from "next/link";
import { Logo } from "@/components/navigation/Logo";
import { GameHeader } from "@/components/ui";

export function SiteHeader() {
  return (
    <GameHeader
      left={
        <Link href="/" aria-label="Ir al inicio">
          <Logo />
        </Link>
      }
      right={
        <nav
          className="flex items-center gap-4 font-mono text-[10px] font-black tracking-[0.12em] uppercase sm:gap-6"
          aria-label="Navegación principal"
        >
          <Link
            className="text-white/45 transition-colors hover:text-white focus-visible:text-white"
            href="/"
          >
            Desafíos
          </Link>
          <Link
            className="text-[var(--color-social)] transition-colors hover:text-white focus-visible:text-white"
            href="/formatos"
          >
            Formatos
          </Link>
        </nav>
      }
    />
  );
}
