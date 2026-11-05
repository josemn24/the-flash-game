const segmenter = new Intl.Segmenter("es", { granularity: "grapheme" });
const isWhitespace = (character: string) => /^\s+$/u.test(character);

export function alphabetAnswerCharacters(value: string): string[] {
  return Array.from(segmenter.segment(value), ({ segment }) => segment);
}

export function countAlphabetAnswerCharacters(value: string): number {
  return alphabetAnswerCharacters(value).filter((character) => !isWhitespace(character)).length;
}

export function deleteLastAlphabetCharacter(value: string): string {
  return alphabetAnswerCharacters(value).slice(0, -1).join("");
}

export type AlphabetAnswerSlot =
  | { kind: "filled"; character: string }
  | { kind: "space" }
  | { kind: "empty"; active: boolean }
  | { kind: "caret" };

/** The principal length guides presentation; it never restricts the draft. */
export function alphabetAnswerSlots(
  value: string,
  answerLength: number | null,
): AlphabetAnswerSlot[] {
  const slots: AlphabetAnswerSlot[] = [];
  let written = 0;
  for (const character of alphabetAnswerCharacters(value)) {
    if (isWhitespace(character)) {
      if (slots.at(-1)?.kind !== "space") slots.push({ kind: "space" });
    } else {
      slots.push({ kind: "filled", character });
      written++;
    }
  }
  const remaining = answerLength === null ? 1 : Math.max(answerLength - written, 0);
  for (let index = 0; index < remaining; index++) {
    slots.push({ kind: "empty", active: index === 0 });
  }
  if (remaining === 0) slots.push({ kind: "caret" });
  return slots;
}
