import { LogoutButton } from "@/components/auth/LogoutButton.client";
import { Avatar, BoltIcon, Canvas } from "@/components/ui";
import type { AdminSection, SuperadminPortalContext } from "@/types/view-models";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNavigation } from "./AdminNavigation";
import styles from "./AdminShell.module.css";

export type AdminBreadcrumb = {
  readonly label: string;
  readonly href?: string;
};

type AdminShellProps = {
  readonly operator: SuperadminPortalContext["operator"];
  readonly activeSection: AdminSection;
  readonly breadcrumbs?: readonly AdminBreadcrumb[];
  readonly children: ReactNode;
};

export function AdminShell({ operator, activeSection, breadcrumbs = [], children }: AdminShellProps) {
  return (
    <Canvas as="div" contentClassName={styles.content}>
      <a className={styles.skipLink} href="#admin-main-content">
        Saltar al contenido principal
      </a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <BoltIcon />
          </span>
          <div>
            <p className={styles.eyebrow}>The Flash · beta privada</p>
            <p className={styles.brandName}>Portal de operaciones</p>
          </div>
        </div>

        <div className={styles.account}>
          <Avatar
            name={operator.displayName}
            initials={operator.displayName.slice(0, 2).toUpperCase()}
            tone="social"
            size="sm"
          />
          <div className={styles.accountCopy}>
            <span className={styles.accountLabel}>Operador</span>
            <strong>{operator.displayName}</strong>
          </div>
          <LogoutButton />
        </div>
      </header>

      <AdminNavigation activeSection={activeSection} />

      {breadcrumbs.length > 0 ? (
        <nav className={styles.breadcrumbs} aria-label="Migas de pan">
          <ol>
            {breadcrumbs.map((breadcrumb, index) => (
              <li key={`${breadcrumb.label}-${index}`}>
                {breadcrumb.href ? <Link href={breadcrumb.href}>{breadcrumb.label}</Link> : <span>{breadcrumb.label}</span>}
                {index < breadcrumbs.length - 1 ? <span aria-hidden="true">/</span> : null}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <main id="admin-main-content" className={styles.main} tabIndex={-1}>{children}</main>
    </Canvas>
  );
}
