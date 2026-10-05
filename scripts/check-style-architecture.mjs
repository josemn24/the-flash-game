import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import postcss from "postcss";
import ts from "typescript";

const colorName =
  /^--(?:ds-color-|color-|state-)|(?:color|ink|muted|faint|accent|surface|danger|success|error|reward|focus|overlay|border|tone)$/;
const designTokenName = /^--(?:space|radius|shadow|type|font|motion|control|ease|border)-/;
const retired = /^--(?:color-(?!background$|foreground$)|state-)/;
const colorProperty =
  /^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|text-decoration-color)$/;
const references = (value) =>
  [...value.matchAll(/var\(\s*(--[\w-]+)\s*[,)]/g)].map((match) => match[1]);
const mentions = (value) =>
  [
    ...value.matchAll(
      /--(?:ds-color|color|state|space|radius|shadow|type|font|motion|control|ease|border)-[\w-]+/g,
    ),
  ]
    .map((match) => match[0])
    .filter((name) => !name.endsWith("-"));

/** Checks source, rather than generated CSS. Local aliases may be inherited by child modules. */
export function checkTokenReferences(sources) {
  const definitions = new Map();
  const uses = [];
  const tokenAliases = new Set();
  const violations = new Set();
  function define(name, value, file, scope) {
    const entries = definitions.get(name) ?? [];
    entries.push({ value, file, scope });
    definitions.set(name, entries);
    if (
      colorName.test(name) ||
      designTokenName.test(name) ||
      references(value).some((ref) => colorName.test(ref) || designTokenName.test(ref))
    )
      tokenAliases.add(name);
    inspect(value, file, name, scope);
    if (retired.test(name)) violations.add(`${file}: token retirado ${name}`);
  }
  function inspect(value, file, prop, scope) {
    for (const name of new Set([...references(value), ...mentions(value)])) {
      uses.push({ name, file, scope, prop });
      if (colorName.test(name) || designTokenName.test(name) || colorProperty.test(prop))
        tokenAliases.add(name);
    }
  }
  for (const [file, source] of sources) {
    if (file.endsWith(".css")) {
      postcss.parse(source, { from: file }).walkDecls((decl) => {
        const scope = decl.parent.type === "rule" ? decl.parent.selector : ":root";
        if (decl.prop.startsWith("--")) define(decl.prop, decl.value, file, scope);
        else inspect(decl.value, file, decl.prop, scope);
      });
    } else if (/\.[jt]sx?$/.test(file)) {
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      // next/font generates these declarations; require an actual font factory call.
      const fontFactories = new Set();
      for (const statement of ast.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          !/^next\/font\/(?:google|local)$/.test(statement.moduleSpecifier.text)
        )
          continue;
        const clause = statement.importClause;
        if (clause?.name) fontFactories.add(clause.name.text);
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings))
          for (const binding of clause.namedBindings.elements) fontFactories.add(binding.name.text);
      }
      function visit(node) {
        if (ts.isPropertyAssignment(node)) {
          const name = node.name.getText(ast).replace(/^["']|["']$/g, "");
          const value = node.initializer.getText(ast);
          const call = node.parent.parent;
          if (
            name === "variable" &&
            ts.isStringLiteral(node.initializer) &&
            node.initializer.text.startsWith("--") &&
            ts.isCallExpression(call) &&
            ts.isIdentifier(call.expression) &&
            fontFactories.has(call.expression.text)
          )
            define(node.initializer.text, "next/font", file, "inline");
          if (name.startsWith("--")) define(name, value, file, "inline");
          else if (
            /^(?:color|background|backgroundColor|border|borderColor|fill|stroke)$/.test(name)
          )
            inspect(value, file, name === "backgroundColor" ? "background-color" : name, "inline");
        }
        if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
          const value = node.getText(ast);
          inspect(value, file, "string", "inline");
          for (const utility of value.matchAll(
            /\b(?:text|bg|border|ring|outline|fill|stroke)-\[[^\]]+\]/g,
          )) {
            inspect(utility[0], file, "color", "inline");
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  // Follow arbitrary local aliases, not just those named "color" or "state".
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, entries] of definitions) {
      if (tokenAliases.has(name)) continue;
      if (entries.some(({ value }) => references(value).some((ref) => tokenAliases.has(ref)))) {
        tokenAliases.add(name);
        changed = true;
      }
    }
    for (const name of tokenAliases) {
      for (const { value } of definitions.get(name) ?? []) {
        for (const ref of references(value)) {
          if (!tokenAliases.has(ref)) {
            tokenAliases.add(ref);
            changed = true;
          }
        }
      }
    }
  }
  for (const { name, file } of uses) {
    if (retired.test(name)) violations.add(`${file}: token retirado ${name}`);
    else if (tokenAliases.has(name) && !definitions.has(name))
      violations.add(`${file}: token desconocido ${name} (el fallback no lo valida)`);
  }
  // Resolve the closest definition; an override is evaluated in its own scope.
  function resolve(name, context) {
    const entries = definitions.get(name) ?? [];
    const scoped = entries.filter(
      (entry) => entry.file === context.file && entry.scope === context.scope,
    );
    const local = entries.filter((entry) => entry.file === context.file);
    const global = entries.filter((entry) => entry.file === "app/globals.css");
    return scoped.length ? scoped : local.length ? local : global.length ? global : entries;
  }
  function visitAlias(name, entry, stack) {
    if (stack.includes(name)) {
      violations.add(
        `${entry.file}: ciclo de aliases ${[...stack.slice(stack.indexOf(name)), name].join(" → ")}`,
      );
      return;
    }
    for (const ref of references(entry.value)) {
      if (!tokenAliases.has(ref)) continue;
      for (const target of resolve(ref, entry)) visitAlias(ref, target, [...stack, name]);
    }
  }
  for (const name of tokenAliases) {
    for (const entry of definitions.get(name) ?? []) visitAlias(name, entry, []);
  }
  return [...violations];
}

export async function checkStyleArchitecture(root = process.cwd()) {
  const files = execFileSync(
    "rg",
    [
      "--files",
      "-g",
      "*.css",
      "-g",
      "*.tsx",
      "-g",
      "*.ts",
      "-g",
      "!*.test.*",
      "-g",
      "!*.spec.*",
      "-g",
      "!*.d.ts",
      "-g",
      "!*.generated.*",
      "-g",
      "!database.types.ts",
      "app",
      "components",
      "features",
      "lib",
      "data",
    ],
    { cwd: root, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  const sources = new Map(
    await Promise.all(
      files.map(async (file) => [file, await readFile(path.join(root, file), "utf8")]),
    ),
  );
  const violations = checkTokenReferences(sources);
  const modules = files.filter((file) => file.endsWith(".module.css"));
  const legacyBrandLiteral =
    /#d7ff1[89]\b|rgb\(\s*215\s+255\s+24\s*\)|rgba\(\s*215\s*,\s*255\s*,\s*24\s*,/i;
  for (const file of modules) {
    const source = sources.get(file);
    if (!/@layer\s+app-(components|formats)\s*\{/.test(source))
      violations.push(`${file}: debe estar dentro de app-components o app-formats`);
    if (/@layer\s+[^\{]*overrides?/i.test(source))
      violations.push(`${file}: no se permite una capa de overrides`);
    if (source.includes("!important"))
      violations.push(
        `${file}: !important solo está permitido en la excepción de reduced-motion global`,
      );
    if (legacyBrandLiteral.test(source))
      violations.push(`${file}: usa los tokens de marca en lugar de literales #d7ff18/#d7ff19`);
    if (source.includes('data-variant="flash-pop"') || source.includes("data-theme"))
      violations.push(`${file}: no puede depender de atributos de tema o variante`);
  }
  const globalStyles = sources.get("app/globals.css");
  if (
    (
      globalStyles.match(
        /@layer app-reset, app-tokens, app-base, app-components, app-formats, app-utilities;/g,
      ) ?? []
    ).length !== 1
  )
    violations.push("app/globals.css: debe declarar una única jerarquía global de capas");
  // Only the body of prefers-reduced-motion may contain the global exception.
  const globalAst = postcss.parse(globalStyles);
  globalAst.walkDecls((decl) => {
    if (!decl.important) return;
    let parent = decl.parent;
    while (
      parent &&
      !(
        parent.type === "atrule" &&
        parent.name === "media" &&
        parent.params.includes("prefers-reduced-motion: reduce")
      )
    )
      parent = parent.parent;
    if (!parent)
      violations.push("app/globals.css: !important solo está permitido dentro de reduced-motion");
  });
  if (globalStyles.includes("app-variants") || globalStyles.includes("data-theme"))
    violations.push(
      "app/globals.css: el tema único no puede declarar capas ni atributos de variantes",
    );
  return { violations, moduleCount: modules.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { violations, moduleCount } = await checkStyleArchitecture();
  if (violations.length) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
  } else
    console.log(`Style architecture OK: ${moduleCount} CSS Modules; tokens y aliases resueltos.`);
}
