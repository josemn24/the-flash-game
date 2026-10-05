import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTokenReferences, checkStyleArchitecture } from "./check-style-architecture.mjs";

const fixtures = [];
async function check(css, tsx = "") {
  const root = await mkdtemp(path.join(tmpdir(), "flash-color-check-"));
  fixtures.push(root);
  const files = new Map([
    [
      "app/globals.css",
      ":root { --ds-color-fg-primary: #171720; --ds-color-bg-surface: #ffffff; }",
    ],
    ["components/Fixture.module.css", css],
    ["components/Fixture.tsx", tsx],
  ]);
  for (const [name, source] of files) await writeFile(path.join(root, path.basename(name)), source);
  const sources = new Map(
    await Promise.all(
      [...files.keys()].map(async (name) => [
        name,
        await readFile(path.join(root, path.basename(name)), "utf8"),
      ]),
    ),
  );
  return checkTokenReferences(sources);
}
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("design token architecture guard", () => {
  it.each([
    "var(--ds-color-fg-missing)",
    "var(--ds-color-fg-missing, #171720)",
    "var(--ds-color-fg-missing, var(--ds-color-fg-primary))",
  ])("rejects unknown references, including fallback: %s", async (value) => {
    expect(await check(`.fixture { color: ${value}; }`)).toEqual(
      expect.arrayContaining([expect.stringContaining("desconocido --ds-color-fg-missing")]),
    );
  });
  it.each(["--color-ink", "--color-accent", "--state-selected"])(
    "rejects retired %s even when locally defined",
    async (name) => {
      expect(await check(`.fixture { ${name}: #123456; color: var(${name}, black); }`)).toEqual(
        expect.arrayContaining([expect.stringContaining(`retirado ${name}`)]),
      );
    },
  );
  it("resolves arbitrary inherited aliases and inline definitions", async () => {
    expect(
      await check(
        ".fixture { --local: var(--ds-color-fg-primary); color: var(--local); background: var(--pair-color); }",
        'const style = { "--pair-color": "#123456" };',
      ),
    ).toEqual([]);
  });
  it("rejects an unknown reference through a local alias", async () => {
    expect(
      await check(".fixture { --local: var(--missing, black); color: var(--local); }"),
    ).toEqual(expect.arrayContaining([expect.stringContaining("desconocido --missing")]));
  });
  it("finds scoped alias cycles and self cycles even with fallback", async () => {
    expect(
      await check(".fixture { --a: var(--b); --b: var(--a, black); color: var(--a); }"),
    ).toEqual(expect.arrayContaining([expect.stringContaining("ciclo de aliases")]));
    expect(
      await check(".fixture { --ds-color-fg-primary: var(--ds-color-fg-primary, black); }"),
    ).toEqual(expect.arrayContaining([expect.stringContaining("ciclo de aliases")]));
  });
  it("does not confuse independent local scopes with a cycle", async () => {
    expect(
      await check(
        ".a { --local: var(--ds-color-fg-primary); color: var(--local); } .b { --local: var(--ds-color-bg-surface); color: var(--local); }",
      ),
    ).toEqual([]);
  });
  it("checks Tailwind and inline color references in TSX", async () => {
    expect(
      await check(
        "",
        'const element = <div className="text-[var(--ds-color-fg-missing,black)] bg-[var(--local-missing,white)]" style={{ color: "var(--unknown)" }} />;',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("desconocido --ds-color-fg-missing"),
        expect.stringContaining("desconocido --unknown"),
        expect.stringContaining("desconocido --local-missing"),
      ]),
    );
  });
  it("ignores unrelated variables and accepts Tailwind bridges", async () => {
    expect(
      await check(
        ".fixture { --color-background: var(--ds-color-bg-surface); width: var(--runtime-width); animation-duration: var(--runtime-duration); background: var(--color-background); }",
      ),
    ).toEqual([]);
  });
  it.each([
    ["padding", "--space-7"],
    ["border-radius", "--radius-missing"],
    ["box-shadow", "--shadow-missing"],
    ["font-family", "--type-missing"],
    ["font-family", "--font-missing"],
    ["transition-duration", "--motion-missing"],
    ["transition-timing-function", "--ease-missing"],
    ["min-height", "--control-missing"],
    ["border", "--border-missing"],
  ])("rejects an unknown %s token with a fallback", async (property, token) => {
    expect(await check(`.fixture { ${property}: var(${token}, initial); }`)).toEqual(
      expect.arrayContaining([expect.stringContaining(`desconocido ${token}`)]),
    );
  });
  it("checks non-color tokens in Tailwind utilities and inline styles", async () => {
    expect(
      await check(
        "",
        'const element = <div className="p-[var(--space-missing)] rounded-[var(--radius-missing)]" style={{ transitionDuration: "var(--motion-missing)" }} />;',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("desconocido --space-missing"),
        expect.stringContaining("desconocido --radius-missing"),
        expect.stringContaining("desconocido --motion-missing"),
      ]),
    );
  });
  it("resolves inherited geometry aliases defined inline", async () => {
    expect(
      await check(
        ".fixture { --space-7: 28px; --inset: var(--space-7); padding: var(--inset); border-radius: var(--radius-local); }",
        'const style = { "--radius-local": "8px" };',
      ),
    ).toEqual([]);
  });
  it("checks upstream geometry aliases and their dependencies", async () => {
    expect(
      await check(".fixture { --inset: var(--space-missing); padding: var(--inset); }"),
    ).toEqual(expect.arrayContaining([expect.stringContaining("desconocido --space-missing")]));
    expect(
      await check(".fixture { --space-7: var(--runtime-missing); padding: var(--space-7); }"),
    ).toEqual(expect.arrayContaining([expect.stringContaining("desconocido --runtime-missing")]));
  });
  it("rejects non-color alias cycles without confusing separate local scopes", async () => {
    expect(
      await check(".fixture { --space-7: var(--inset); --inset: var(--space-7, 28px); }"),
    ).toEqual(expect.arrayContaining([expect.stringContaining("ciclo de aliases")]));
    expect(
      await check(
        ".a { --space-local: 28px; --inset: var(--space-local); } .b { --space-local: 32px; --inset: var(--space-local); }",
      ),
    ).toEqual([]);
  });
  it("recognizes variables generated by imported next/font factories", async () => {
    expect(
      await check(
        ".fixture { --type-ui: var(--font-ui); --type-display: var(--font-display); }",
        'import { Manrope as uiFont } from "next/font/google"; import localFont from "next/font/local"; const ui = uiFont({ variable: "--font-ui" }); const display = localFont({ src: "./display.woff2", variable: "--font-display" });',
      ),
    ).toEqual([]);
  });
  it("does not accept undeclared fonts or arbitrary variable properties", async () => {
    expect(
      await check(
        ".fixture { --type-ui: var(--font-missing); }",
        'const unrelated = { variable: "--font-missing" };',
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining("desconocido --font-missing")]));
  });
  it("checks source files while excluding generated sources and test fixtures", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "flash-source-check-"));
    fixtures.push(root);
    for (const dir of ["app", "components", "features", "lib", "data"])
      await mkdir(path.join(root, dir));
    await writeFile(
      path.join(root, "app/globals.css"),
      "@layer app-reset, app-tokens, app-base, app-components, app-formats, app-utilities; @layer app-tokens { :root { --ds-color-fg-primary: #171720; } }",
    );
    await writeFile(
      path.join(root, "components/Fixture.module.css"),
      "@layer app-components { .fixture { color: var(--ds-color-fg-primary); width: var(--space-missing); } }",
    );
    await writeFile(
      path.join(root, "app/ignored.generated.tsx"),
      'const generated = <div style={{ color: "var(--color-retired)" }} />;',
    );
    await writeFile(
      path.join(root, "components/Fixture.test.tsx"),
      'const test = "var(--ds-color-fg-missing)";',
    );
    expect(await checkStyleArchitecture(root)).toEqual({
      violations: [expect.stringContaining("desconocido --space-missing")],
      moduleCount: 1,
    });
  });
});
