import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

function withoutFences(source) {
  let fence = null;
  return source
    .split("\n")
    .map((line) => {
      const marker = line.match(/^ {0,3}(\x60{3,}|~{3,})/);
      if (fence) {
        if (
          marker &&
          marker[1][0] === fence[0] &&
          marker[1].length >= fence.length &&
          !line.slice(marker[0].length).trim()
        )
          fence = null;
        return "";
      }
      if (marker) {
        fence = marker[1];
        return "";
      }
      return line;
    })
    .join("\n");
}

function headingSlug(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, "")
    .replace(/\s/g, "-");
}

export function markdownAnchors(source) {
  const body = withoutFences(source);
  const anchors = new Set();
  const counts = new Map();
  const lines = body.split("\n");
  for (const [index, line] of lines.entries()) {
    const atx = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const setext = lines[index + 1]?.match(/^ {0,3}(?:=+|-+)\s*$/);
    if (!atx && !(line.trim() && setext)) continue;
    const base = headingSlug(atx?.[1] ?? line.trim());
    let candidate = base;
    let suffix = counts.get(base) ?? 0;
    while (anchors.has(candidate)) candidate = base + "-" + ++suffix;
    counts.set(base, suffix);
    anchors.add(candidate);
  }
  for (const match of body.matchAll(/<[^>]+\b(?:id|name)=["']([^"']+)["'][^>]*>/g))
    anchors.add(match[1]);
  return anchors;
}

export function checkDocumentation(root = defaultRoot) {
  const docsRoot = join(root, "docs");
  const rootFiles = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(root, entry.name));
  const files = [
    ...rootFiles,
    ...["docs", "supabase", "data"].flatMap((directory) => markdownFiles(join(root, directory))),
  ].sort();
  const broken = [];
  const anchorCache = new Map();
  const normalizeReference = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();

  for (const file of files) {
    const body = withoutFences(readFileSync(file, "utf8"));
    const source = body.replace(/(\x60+)[^\n]*?\1/g, (match) => " ".repeat(match.length));
    const definitions = new Set();
    const targets = [];
    const inline =
      /!?\[(?:[^\[\]\n]|\[[^\]\n]*\])*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^"\n]*["'])?\s*\)/g;
    const reference = /^ {0,3}\[([^\]]+)\]:\s*(<[^>\n]+>|[^\s]+)/gm;
    for (const match of source.matchAll(inline)) targets.push(match[1]);
    for (const match of source.matchAll(reference)) {
      definitions.add(normalizeReference(match[1]));
      targets.push(match[2]);
    }
    for (const match of source.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
      const label = normalizeReference(match[2] || match[1]);
      if (!definitions.has(label))
        broken.push(relative(root, file) + " -> [" + label + "] (undefined reference)");
    }

    for (let target of targets) {
      if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
      if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const hash = target.indexOf("#");
      const fragment = hash < 0 ? "" : target.slice(hash + 1);
      const path = (hash < 0 ? target : target.slice(0, hash)).split("?", 1)[0];
      let destination;
      let decodedFragment;
      try {
        destination = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
        decodedFragment = decodeURIComponent(fragment);
      } catch {
        broken.push(relative(root, file) + " -> " + target + " (invalid URL encoding)");
        continue;
      }
      if (!existsSync(destination)) {
        broken.push(relative(root, file) + " -> " + target + " (missing file)");
        continue;
      }
      if (statSync(destination).isDirectory()) {
        if (!decodedFragment) continue;
        destination = join(destination, "README.md");
        if (!existsSync(destination)) {
          broken.push(relative(root, file) + " -> " + target + " (directory has no README.md)");
          continue;
        }
      }
      if (decodedFragment && extname(destination) === ".md") {
        if (!anchorCache.has(destination))
          anchorCache.set(destination, markdownAnchors(readFileSync(destination, "utf8")));
        if (!anchorCache.get(destination).has(decodedFragment))
          broken.push(relative(root, file) + " -> " + target + " (missing heading or anchor)");
      }
    }
  }

  const activeFiles = ["current", "product", "content", "decisions"].flatMap((directory) =>
    markdownFiles(join(docsRoot, directory)),
  );
  const statePattern =
    /^\s*(?:>\s*)?(?:#{1,6}\s+)?(?:[-*]\s+)?(?:\*\*)?(?:Estado|Status)(?:\*\*)?(?:\s|:)/im;
  const missingState = activeFiles
    .filter((file) => !statePattern.test(readFileSync(file, "utf8")))
    .map((file) => relative(root, file));
  return { files: files.map((file) => relative(root, file)), broken, missingState };
}

function main() {
  const { files, broken, missingState } = checkDocumentation();
  if (broken.length) {
    console.error("Broken documentation links:");
    for (const issue of broken) console.error("- " + issue);
  }
  if (missingState.length) {
    console.error("Active documentation without an explicit state:");
    for (const file of missingState) console.error("- " + file);
  }
  if (broken.length || missingState.length) process.exitCode = 1;
  else
    console.log(
      "Documentation checks OK (" + files.length + " Markdown files; local anchors included).",
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
