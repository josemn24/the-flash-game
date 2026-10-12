import Link from "next/link";
import { Chip } from "@/components/ui";
import { catalogGroups } from "./registry";
import { CatalogNavigation } from "./CatalogNavigation.client";
import styles from "./Catalog.module.css";

export function CatalogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell} data-surface="design-system">
      <a className={styles.skip} href="#catalog-content">
        Saltar al contenido
      </a>
      <header className={styles.masthead}>
        <Link className={styles.brand} href="/design-system">
          The Flash · Design System
        </Link>
        <Chip tone="social">Solo desarrollo</Chip>
      </header>
      <div className={styles.layout}>
        <aside>
          <CatalogNavigation groups={catalogGroups} />
        </aside>
        <main className={styles.main} id="catalog-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
