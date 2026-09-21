import Link from "next/link";
import { Logo } from "@/components/navigation/Logo";
import { GameHeader } from "@/components/ui";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <GameHeader
      left={
        <Link href="/" aria-label="Ir al inicio">
          <Logo />
        </Link>
      }
      right={
        <nav className={styles.nav} aria-label="Navegación principal">
          <Link className={styles.navLink} href="/">
            Desafíos
          </Link>
          <Link className={`${styles.navLink} ${styles.navLinkActive}`} href="/formatos">
            Formatos
          </Link>
        </nav>
      }
    />
  );
}
