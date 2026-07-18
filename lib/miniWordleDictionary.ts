import {
  isValidMiniWordleWord,
  MINI_WORDLE_WORD_LENGTH,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";

export const MINI_WORDLE_DICTIONARY_URL = "/dictionaries/es-general-4.v1.json";

export type MiniWordleDictionaryPayload = {
  schemaVersion: 1;
  id: "es-general-4";
  wordLength: 4;
  normalization: "uppercase-no-diacritics-preserve-enye";
  wordCount: number;
  words: string[];
};

export function parseMiniWordleDictionary(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Respuesta de diccionario no válida.");
  const payload = value as Partial<MiniWordleDictionaryPayload>;
  if (
    payload.schemaVersion !== 1 ||
    payload.id !== "es-general-4" ||
    payload.wordLength !== MINI_WORDLE_WORD_LENGTH ||
    payload.normalization !== "uppercase-no-diacritics-preserve-enye" ||
    !Array.isArray(payload.words) ||
    payload.wordCount !== payload.words.length ||
    !payload.words.every(
      (word) =>
        typeof word === "string" &&
        isValidMiniWordleWord(word) &&
        word === normalizeMiniWordleWord(word),
    ) ||
    new Set(payload.words).size !== payload.words.length ||
    payload.words.some(
      (word, index) => index > 0 && payload.words![index - 1].localeCompare(word, "es") >= 0,
    )
  ) {
    throw new Error("El diccionario de Mini-Wordle tiene un formato incompatible.");
  }
  return new Set(payload.words);
}

let dictionaryPromise: Promise<Set<string>> | null = null;

export function loadMiniWordleDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = fetch(MINI_WORDLE_DICTIONARY_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar el diccionario (${response.status}).`);
        return response.json();
      })
      .then(parseMiniWordleDictionary)
      .catch((error: unknown) => {
        dictionaryPromise = null;
        throw error;
      });
  }
  return dictionaryPromise;
}
