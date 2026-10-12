import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findCatalogEntry } from "@/features/design-system/registry";
import { CatalogArticle } from "@/features/design-system/CatalogArticle";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = findCatalogEntry("componentes", (await params).slug);
  return { title: entry?.title ?? "Componente desconocido" };
}
export default async function ComponentPage({ params }: Props) {
  const entry = findCatalogEntry("componentes", (await params).slug);
  if (!entry) notFound();
  return <CatalogArticle entry={entry} category="componentes" />;
}
