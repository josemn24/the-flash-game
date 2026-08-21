import {
  DEFAULT_MINI_WORDLE_WORD_LENGTH,
  isValidMiniWordleWord,
  type MiniWordleWordLength,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";

export function getMiniWordleDictionaryUrl(wordLength: MiniWordleWordLength) {
  return `/dictionaries/es-general-${wordLength}.v1.json`;
}

export type MiniWordleDictionaryPayload = {
  schemaVersion: 1;
  id: string;
  wordLength: MiniWordleWordLength;
  normalization: "uppercase-no-diacritics-preserve-enye";
  wordCount: number;
  words: string[];
};

export function parseMiniWordleDictionary(
  value: unknown,
  wordLength: MiniWordleWordLength = DEFAULT_MINI_WORDLE_WORD_LENGTH,
) {
  if (!value || typeof value !== "object") throw new Error("Respuesta de diccionario no válida.");
  const payload = value as Partial<MiniWordleDictionaryPayload>;
  if (
    payload.schemaVersion !== 1 ||
    payload.id !== `es-general-${wordLength}` ||
    payload.wordLength !== wordLength ||
    payload.normalization !== "uppercase-no-diacritics-preserve-enye" ||
    !Array.isArray(payload.words) ||
    payload.wordCount !== payload.words.length ||
    !payload.words.every(
      (word) =>
        typeof word === "string" &&
        isValidMiniWordleWord(word, wordLength) &&
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

const dictionaryPromises = new Map<MiniWordleWordLength, Promise<Set<string>>>();

export function loadMiniWordleDictionary(
  wordLength: MiniWordleWordLength = DEFAULT_MINI_WORDLE_WORD_LENGTH,
) {
  const existing = dictionaryPromises.get(wordLength);
  if (existing) return existing;

  const dictionaryPromise = fetch(getMiniWordleDictionaryUrl(wordLength), { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`No se pudo cargar el diccionario (${response.status}).`);
      return response.json();
    })
    .then((payload) => parseMiniWordleDictionary(payload, wordLength))
    .catch((error: unknown) => {
      dictionaryPromises.delete(wordLength);
      throw error;
    });

  dictionaryPromises.set(wordLength, dictionaryPromise);
  return dictionaryPromise;
}
