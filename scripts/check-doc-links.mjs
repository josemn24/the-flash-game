import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const docsRoot = join(root, "docs");

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

const files = [join(root, "README.md"), ...markdownFiles(docsRoot)];
const broken = [];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    if (!target || target.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    target = target.split("#", 1)[0];
    const destination = resolve(join(file, ".."), target);
    if (!existsSync(destination)) {
      broken.push(`${relative(root, file)} -> ${target}`);
      continue;
    }
    if (statSync(destination).isDirectory() && !existsSync(join(destination, "README.md"))) {
      broken.push(`${relative(root, file)} -> ${target} (directory has no README.md)`);
    }
  }
}

const activeRoots = ["current", "product", "content", "decisions"].map((directory) =>
  join(docsRoot, directory),
);
const activeFiles = activeRoots.flatMap(markdownFiles);
const statePattern =
  /^\s*(?:>\s*)?(?:#{1,6}\s+)?(?:[-*]\s+)?(?:\*\*)?(?:Estado|Status)(?:\*\*)?(?:\s|:)/im;
const missingState = activeFiles.filter((file) => !statePattern.test(readFileSync(file, "utf8")));

if (broken.length > 0) {
  console.error("Broken documentation links:");
  for (const link of broken) console.error(`- ${link}`);
}

if (missingState.length > 0) {
  console.error("Active documentation without an explicit state:");
  for (const file of missingState) console.error(`- ${relative(root, file)}`);
}

if (broken.length > 0 || missingState.length > 0) process.exitCode = 1;
else console.log(`Documentation checks OK (${files.length} Markdown files checked).`);
