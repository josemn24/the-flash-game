import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkDocumentation, markdownAnchors } from "./check-doc-links.mjs";

const fixtures = [];

function repository(files) {
  const root = mkdtempSync(join(tmpdir(), "flash-documentation-"));
  fixtures.push(root);
  for (const [file, content] of Object.entries(files)) {
    const destination = join(root, file);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
  return root;
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("documentation links", () => {
  it("checks auxiliary READMEs and the changelog, including encoded paths and directory links", () => {
    const root = repository({
      "README.md": "[Docs](docs/)\n[Guía](docs/gu%C3%ADa%20local.md#instalaci%C3%B3n)",
      "CHANGELOG.md": "[Schema](supabase/schemas/)\n[Directory](docs/no-index/)",
      "docs/README.md": "# Documentación",
      "docs/guía local.md": "# Instalación",
      "supabase/schemas/README.md": "[Missing](missing.md)",
      "data/README.md": "[Missing](absent.md)",
      "docs/no-index/exists.txt": "Valid directory link",
      "node_modules/ignored/README.md": "[Ignore](missing.md)",
    });
    const result = checkDocumentation(root);
    expect(result.files).toHaveLength(6);
    expect(result.broken).toEqual([
      "data/README.md -> absent.md (missing file)",
      "supabase/schemas/README.md -> missing.md (missing file)",
    ]);
  });

  it("reports missing files, headings, directory indices and invalid URL encoding", () => {
    const root = repository({
      "README.md":
        "# Inicio\n[Local](#ausente)\n[Other](docs/guide.md#ausente)\n[File](missing.md)\n[Directory](docs/no-index/#section)\n[Encoding](bad%ZZ.md)",
      "docs/guide.md": "# Existe",
      "docs/no-index/child.md": "# Child",
    });
    expect(checkDocumentation(root).broken).toEqual([
      "README.md -> #ausente (missing heading or anchor)",
      "README.md -> docs/guide.md#ausente (missing heading or anchor)",
      "README.md -> missing.md (missing file)",
      "README.md -> docs/no-index/#section (directory has no README.md)",
      "README.md -> bad%ZZ.md (invalid URL encoding)",
    ]);
  });

  it("resolves reference links and ignores external links and fenced examples", () => {
    const root = repository({
      "README.md": [
        "[Guide][local] [Unknown][missing]",
        "[local]: docs/guide.md#guía",
        "[unreferenced]: absent.md",
        "[Remote](https://example.com/no-file#no-heading)",
        "[Mail](mailto:test@example.com)",
        "```md",
        "[Example](missing-example.md)",
        "[Example][unknown]",
        "```",
        "`[Inline example](also-missing.md)`",
      ].join("\n"),
      "docs/guide.md": "# Guía",
    });
    expect(checkDocumentation(root).broken).toEqual([
      "README.md -> [missing] (undefined reference)",
      "README.md -> absent.md (missing file)",
    ]);
  });

  it("requires an explicit state in active documentation only", () => {
    const root = repository({
      "README.md": "# Home",
      "docs/current/guide.md": "# Guide\n\n> **Estado**: vigente.",
      "docs/product/proposal.md": "# Proposal\n\nEstado: propuesta.",
      "docs/content/catalog.md": "# Catalog",
      "docs/decisions/record.md": "# Record\n\n## Estado\nAceptado.",
      "docs/archive/report.md": "# Historical report",
    });
    expect(checkDocumentation(root).missingState).toEqual(["docs/content/catalog.md"]);
  });
});

describe("Markdown anchors", () => {
  it("supports Unicode, repeated headings, setext headings and explicit HTML anchors", () => {
    const anchors = markdownAnchors(
      '# Revisión de `SQL` y [datos](data.md)\n## Revisión de SQL y datos\nInstalación\n---\n<a id="legacy-anchor"></a>\n<a name="old-name"></a>',
    );
    expect([...anchors]).toEqual([
      "revisión-de-sql-y-datos",
      "revisión-de-sql-y-datos-1",
      "instalación",
      "legacy-anchor",
      "old-name",
    ]);
  });

  it("does not accept headings inside backtick or tilde fences", () => {
    expect([
      ...markdownAnchors("# Visible\n```md\n# Fake\n```\n~~~~\n# Also fake\n~~~~\n## Final"),
    ]).toEqual(["visible", "final"]);
  });
});
