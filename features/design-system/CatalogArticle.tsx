import Link from "next/link";
import type { CatalogEntry } from "./registry";
import { ExampleFrame } from "./ExampleFrame.client";
import { CatalogExample } from "./examples/CatalogExample";
import styles from "./Catalog.module.css";

export function CatalogArticle({
  entry,
  category,
}: {
  entry: CatalogEntry;
  category: "componentes" | "patrones";
}) {
  return (
    <article className={styles.article}>
      <header className={styles.intro}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
          <Link href="/design-system">Design system</Link>
          <span>/</span>
          <span>{category === "componentes" ? "Componentes" : "Patrones"}</span>
          <span>/</span>
          <span aria-current="page">{entry.title}</span>
        </nav>
        <h1>{entry.title}</h1>
        <p>{entry.summary}</p>
      </header>
      <nav className={styles.anchors} aria-label="En esta ficha">
        <a href="#uso">Uso</a>
        <a href="#api">Propiedades</a>
        <a href="#estados">Estados</a>
        <a href="#accesibilidad">Accesibilidad</a>
        <a href="#ejemplos">Ejemplos</a>
      </nav>
      <section id="uso">
        <h2>Cuándo utilizarlo</h2>
        <ul>
          {entry.when.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section id="api">
        <h2>Propiedades y valores predeterminados</h2>
        <div
          className={styles.tableWrap}
          tabIndex={0}
          role="region"
          aria-label={`Propiedades de ${entry.title}`}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Propiedad</th>
                <th>Valores</th>
                <th>Por defecto</th>
                <th>Comportamiento</th>
              </tr>
            </thead>
            <tbody>
              {entry.properties.map(([name, values, defaultValue, usage]) => (
                <tr key={name}>
                  <th scope="row">
                    <code>{name}</code>
                  </th>
                  <td>{values}</td>
                  <td>{defaultValue}</td>
                  <td>{usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="estados">
        <h2>Estados documentados</h2>
        <ul>
          {entry.states.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section id="accesibilidad">
        <h2>Accesibilidad</h2>
        <ul>
          {entry.accessibility.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section id="ejemplos">
        <h2>Demos guiadas</h2>
        {entry.examples.map((example) => (
          <section key={example.id} id={`ejemplo-${example.id}`}>
            <h3>{example.title}</h3>
            {example.isolated ? (
              <ExampleFrame id={example.id} title={example.title} />
            ) : (
              <CatalogExample id={example.id} />
            )}
            <pre className={styles.code} tabIndex={0} aria-label={`Código de ${example.title}`}>
              <code>{example.code}</code>
            </pre>
          </section>
        ))}
      </section>
    </article>
  );
}
