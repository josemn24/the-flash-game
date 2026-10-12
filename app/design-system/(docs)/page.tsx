import type { Metadata } from "next";
import Link from "next/link";
import { componentEntries, patternEntries } from "@/features/design-system/registry";
import styles from "@/features/design-system/Catalog.module.css";
export const metadata: Metadata = { title: "Introducción" };
export default function DesignSystemPage() {
  return (
    <article className={styles.article}>
      <header className={styles.intro}>
        <h1>Un lenguaje común para The Flash.</h1>
        <p>
          Fundamentos, componentes reales y patrones existentes de Flash Pop. Una referencia para
          construir interfaces coherentes y detectar qué falta consolidar.
        </p>
      </header>
      <nav className={styles.anchors} aria-label="En esta página">
        <a href="#organizacion">Organización</a>
        <a href="#inventario">Inventario</a>
        <a href="#pendiente">Mejoras pendientes</a>
      </nav>
      <section id="organizacion">
        <h2>Cómo utilizar el catálogo</h2>
        <ol>
          <li>
            Consulta los <Link href="/design-system/fundamentos">fundamentos</Link> para elegir
            roles y escalas.
          </li>
          <li>Elige un componente según su propósito y revisa su API vigente.</li>
          <li>Usa los patrones para componer estados completos y prueba sus demos locales.</li>
          <li>
            Verifica los <Link href="/design-system/accesibilidad">criterios de accesibilidad</Link>{" "}
            en cada interacción.
          </li>
        </ol>
        <p>
          Las demos usan datos ficticios y acciones locales. No necesitan sesión ni base de datos.
        </p>
      </section>
      <section id="inventario">
        <h2>Inventario implementado</h2>
        {(
          [
            ["componentes", "Componentes", componentEntries],
            ["patrones", "Patrones", patternEntries],
          ] as const
        ).map(([category, title, entries]) => (
          <section key={category}>
            <h3>{title}</h3>
            <div className={styles.grid}>
              {entries.map((entry) => (
                <div key={entry.slug} className={styles.entry}>
                  <h3>
                    <Link href={`/design-system/${category}/${entry.slug}`}>{entry.title}</Link>
                  </h3>
                  <p>{entry.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </section>
      <section id="pendiente">
        <h2>Mejoras para una siguiente fase</h2>
        <ul>
          <li>
            Consolidar los avisos administrativos y de juego cuando compartan intención y semántica.
          </li>
          <li>
            Revisar los aliases default/hero de tamaños y la convivencia de padding/density en Card.
          </li>
          <li>
            Precisar la relación entre variantes social/danger y roles selected/error; blue/aqua
            comparten actualmente color.
          </li>
          <li>Completar los contratos de composición y movimiento.</li>
        </ul>
        <p>
          Este catálogo documenta la implementación actual. Las mejoras anteriores no cambian las
          APIs en esta fase.
        </p>
      </section>
    </article>
  );
}
