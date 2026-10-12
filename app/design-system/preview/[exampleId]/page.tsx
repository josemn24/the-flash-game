import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findCatalogExample } from "@/features/design-system/registry";
import { CatalogExample } from "@/features/design-system/examples/CatalogExample";
import styles from "@/features/design-system/Catalog.module.css";
type Props = { params: Promise<{ exampleId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const example = findCatalogExample((await params).exampleId);
  return { title: example ? `Preview · ${example.title}` : "Preview desconocido" };
}
export default async function PreviewPage({ params }: Props) {
  const example = findCatalogExample((await params).exampleId);
  if (!example) notFound();
  return (
    <div className={styles.preview} data-preview-content>
      <CatalogExample id={example.id} />
    </div>
  );
}
