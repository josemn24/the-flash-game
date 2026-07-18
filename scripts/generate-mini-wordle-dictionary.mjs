import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dictionary from "dictionary-es";
import nspell from "nspell";

const WORD_LENGTH = 4;
const ALPHABET = Array.from("abcdefghijklmnñopqrstuvwxyzáéíóúü");
const OUTPUT_URL = new URL("../public/dictionaries/es-general-4.v1.json", import.meta.url);
const OVERRIDES_URL = new URL(
  "../data/dictionaries/mini-wordle-es-4.overrides.json",
  import.meta.url,
);

function normalizeWord(value) {
  return value
    .trim()
    .toLocaleUpperCase("es-ES")
    .normalize("NFD")
    .replace(/N\u0303/g, "Ñ")
    .replace(/[\u0300-\u036f]/g, "");
}

function validateOverrideList(name, values) {
  if (!Array.isArray(values)) throw new Error(`Overrides.${name} debe ser un array.`);
  return values.map((value) => {
    if (typeof value !== "string") throw new Error(`Overrides.${name} solo admite texto.`);
    const normalized = normalizeWord(value);
    if (Array.from(normalized).length !== WORD_LENGTH || !/^[A-ZÑ]+$/.test(normalized)) {
      throw new Error(`Palabra no válida en overrides.${name}: ${value}`);
    }
    return normalized;
  });
}

async function buildDictionaryPayload() {
  const spell = nspell(dictionary);
  const accepted = new Set();

  for (const first of ALPHABET) {
    for (const second of ALPHABET) {
      for (const third of ALPHABET) {
        for (const fourth of ALPHABET) {
          const candidate = first + second + third + fourth;
          if (spell.correct(candidate)) accepted.add(normalizeWord(candidate));
        }
      }
    }
  }

  const overrides = JSON.parse(await readFile(OVERRIDES_URL, "utf8"));
  const allow = validateOverrideList("allow", overrides.allow);
  const deny = validateOverrideList("deny", overrides.deny);
  const overlap = allow.find((word) => deny.includes(word));
  if (overlap) throw new Error(`La palabra ${overlap} aparece en allow y deny.`);

  allow.forEach((word) => accepted.add(word));
  deny.forEach((word) => accepted.delete(word));
  const words = [...accepted].sort((left, right) => left.localeCompare(right, "es"));

  return {
    schemaVersion: 1,
    id: "es-general-4",
    source: {
      package: "dictionary-es@4.0.0",
      upstream: "https://github.com/sbosio/rla-es",
      dictionaryVersion: "2.8",
      license: "MPL-1.1-or-later",
    },
    wordLength: WORD_LENGTH,
    normalization: "uppercase-no-diacritics-preserve-enye",
    wordCount: words.length,
    words,
  };
}

const payload = await buildDictionaryPayload();
const serialized = `${JSON.stringify(payload)}\n`;
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  let current;
  try {
    current = await readFile(OUTPUT_URL, "utf8");
  } catch {
    throw new Error(`Falta ${fileURLToPath(OUTPUT_URL)}. Ejecuta npm run dictionary:generate.`);
  }
  if (current !== serialized) {
    throw new Error(
      "El vocabulario generado no está actualizado. Ejecuta npm run dictionary:generate.",
    );
  }
  console.log(`Diccionario verificado: ${payload.wordCount} palabras.`);
} else {
  await mkdir(new URL(".", OUTPUT_URL), { recursive: true });
  await writeFile(OUTPUT_URL, serialized);
  console.log(
    `Diccionario generado: ${payload.wordCount} palabras en ${fileURLToPath(OUTPUT_URL)}.`,
  );
}
