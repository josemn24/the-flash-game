import { Card } from "@/components/ui";
import type { SuperadminChallengeVersionComparison } from "@/types/view-models/editorial";
import styles from "../EditorialManagement.module.css";

function jsonValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function changed(from: unknown, to: unknown) {
  return JSON.stringify(from) !== JSON.stringify(to);
}

export function ComparisonPanel({
  comparison,
}: {
  readonly comparison: SuperadminChallengeVersionComparison;
}) {
  const fields = [
    ["Título", comparison.from.title, comparison.to.title],
    ["Subtítulo", comparison.from.subtitle, comparison.to.subtitle],
    ["Descripción", comparison.from.description, comparison.to.description],
    ["Modo", comparison.from.mode, comparison.to.mode],
    ["Configuración del modo", comparison.from.modeConfig, comparison.to.modeConfig],
  ] as const;
  const fieldChanges = fields.filter(([, from, to]) => changed(from, to));
  const maxItems = Math.max(comparison.from.items.length, comparison.to.items.length);
  const itemChanges = Array.from({ length: maxItems }, (_, index) => {
    const from = comparison.from.items[index];
    const to = comparison.to.items[index];
    if (!from || !to) return { position: index + 1, from, to, changes: ["elemento"] };
    const changes = [
      changed(from.questionVersionId, to.questionVersionId) && "referencia",
      changed(from.slug, to.slug) && "slug",
      changed(from.type, to.type) && "formato",
      changed(from.timeLimitMs, to.timeLimitMs) && "tiempo",
      changed(from.points, to.points) && "puntos",
      changed(from.modeConfig, to.modeConfig) && "configuración",
      changed(from.publicPayload, to.publicPayload) && "contenido público",
    ].filter(Boolean) as string[];
    return { position: index + 1, from, to, changes };
  }).filter((item) => item.changes.length > 0);
  const hasChanges = fieldChanges.length > 0 || itemChanges.length > 0;

  return (
    <Card as="section" surface="soft" aria-labelledby="editorial-comparison-title">
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>Comparación editorial</p>
          <h3 id="editorial-comparison-title">
            v{comparison.from.versionNumber} → v{comparison.to.versionNumber}
          </h3>
        </div>
        <span className={styles.helper}>
          Se comparan referencias y payloads públicos; las soluciones privadas no se muestran.
        </span>
      </div>
      {hasChanges ? (
        <div className={styles.comparisonList}>
          {fieldChanges.map(([label, from, to]) => (
            <div className={styles.comparisonRow} key={label}>
              <strong>{label}</strong>
              <span>{jsonValue(from)}</span>
              <span>{jsonValue(to)}</span>
            </div>
          ))}
          {itemChanges.map((item) => (
            <div className={styles.comparisonRow} key={item.position}>
              <strong>Pregunta #{item.position}</strong>
              <span>{item.from ? item.changes.join(", ") : "Elemento añadido"}</span>
              <span>{item.to ? item.changes.join(", ") : "Elemento eliminado"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.helper}>No hay diferencias editoriales entre estas versiones.</p>
      )}
    </Card>
  );
}
