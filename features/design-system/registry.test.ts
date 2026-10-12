import { describe, expect, it } from "vitest";
import {
  catalogExamples,
  catalogGroups,
  componentEntries,
  patternEntries,
  findCatalogEntry,
  findCatalogExample,
} from "./registry";
import { catalogExampleIds } from "./examples/CatalogExample";
describe("design system registry", () => {
  it("has unique destinations and slugs, with complete documentation", () => {
    const hrefs = catalogGroups.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      if (
        ["/design-system", "/design-system/fundamentos", "/design-system/accesibilidad"].includes(
          href,
        )
      )
        continue;
      const match = href.match(/^\/design-system\/(componentes|patrones)\/([^/]+)$/);
      expect(match, href).not.toBeNull();
      expect(
        findCatalogEntry(match![1] as "componentes" | "patrones", match![2]),
        href,
      ).toBeDefined();
    }
    for (const [category, entries] of [
      ["componentes", componentEntries],
      ["patrones", patternEntries],
    ] as const) {
      expect(new Set(entries.map((entry) => entry.slug)).size).toBe(entries.length);
      for (const entry of entries) {
        expect(hrefs).toContain(`/design-system/${category}/${entry.slug}`);
        expect(findCatalogEntry(category, entry.slug)).toBe(entry);
        for (const field of [
          entry.when,
          entry.properties,
          entry.states,
          entry.accessibility,
          entry.examples,
        ])
          expect(field.length).toBeGreaterThan(0);
      }
    }
  });
  it("resolves every example to a real renderer without orphan renderers", () => {
    const ids = catalogExamples.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...catalogExampleIds].sort());
    for (const example of catalogExamples) expect(findCatalogExample(example.id)).toBe(example);
    expect(findCatalogEntry("componentes", "missing")).toBeUndefined();
    expect(findCatalogExample("missing")).toBeUndefined();
  });
});
