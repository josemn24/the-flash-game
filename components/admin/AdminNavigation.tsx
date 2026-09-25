import Link from "next/link";
import type { AdminSection } from "@/types/view-models";
import styles from "./AdminShell.module.css";

export const ADMIN_NAV_ITEMS = [
  { id: "overview", label: "Resumen", href: "/admin" },
  { id: "rooms", label: "Salas", href: "/admin/rooms" },
  { id: "challenges", label: "Desafíos", href: "/admin/challenges" },
  { id: "questions", label: "Preguntas", href: "/admin/questions" },
] as const satisfies ReadonlyArray<{ id: AdminSection; label: string; href: string }>;

type AdminNavigationProps = {
  readonly activeSection: AdminSection;
};

export function AdminNavigation({ activeSection }: AdminNavigationProps) {
  return (
    <nav className={styles.navigation} aria-label="Navegación del portal">
      <ul className={styles.navList}>
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = item.id === activeSection;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={styles.navLink}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
