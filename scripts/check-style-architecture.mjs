import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const files = execFileSync("rg", ["--files", "-g", "*.module.css"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const violations = [];
const legacyBrandLiteral =
  /#d7ff1[89]\b|rgb\(\s*215\s+255\s+24\s*\)|rgba\(\s*215\s*,\s*255\s*,\s*24\s*,/i;

for (const file of files) {
  const source = await readFile(file, "utf8");

  if (!source.match(/@layer\s+app-(components|formats)\s*\{/)) {
    violations.push(`${file}: debe estar dentro de app-components o app-formats`);
  }

  if (/@layer\s+[^\{]*overrides?/i.test(source)) {
    violations.push(`${file}: no se permite una capa de overrides`);
  }

  if (source.includes("!important")) {
    violations.push(
      `${file}: !important solo está permitido en la excepción de reduced-motion global`,
    );
  }

  if (legacyBrandLiteral.test(source)) {
    violations.push(`${file}: usa los tokens de marca en lugar de literales #d7ff18/#d7ff19`);
  }
}

const globalStyles = await readFile("app/globals.css", "utf8");
const layerOrder =
  globalStyles.match(
    /@layer app-reset, app-tokens, app-base, app-components, app-formats, app-variants, app-utilities;/g,
  ) ?? [];

if (layerOrder.length !== 1) {
  violations.push("app/globals.css: debe declarar una única jerarquía global de capas");
}

const importantOutsideMotion = globalStyles.split(/@layer app-base\s*\{/)[0].includes("!important");

if (importantOutsideMotion) {
  violations.push("app/globals.css: !important solo está permitido dentro de reduced-motion");
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Style architecture OK: ${files.length} CSS Modules dentro de capas permitidas.`);
}
