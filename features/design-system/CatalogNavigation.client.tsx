"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./Catalog.module.css";

export type NavigationGroup = { title: string; items: { href: string; title: string }[] };
export function CatalogNavigation({ groups }: { groups: NavigationGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <>
      <nav className={styles.navigation} aria-label="Navegación del design system">
        {groups.map((group) => (
          <div key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <label className={styles.mobileNavigation}>
        Sección del design system
        <select
          className={styles.select}
          value={pathname}
          onChange={(event) => router.push(event.currentTarget.value)}
        >
          {groups.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.items.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  );
}
