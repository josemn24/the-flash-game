import { describe, expect, it } from "vitest";
import {
  alphabetAnswerSlots,
  countAlphabetAnswerCharacters,
  deleteLastAlphabetCharacter,
} from "./alphabetAnswerSlots";

describe("Alphabet reference slots", () => {
  it.each([
    ["archipiélago", 12],
    ["archipiélagos", 13],
    ["Ña\u0301", 2],
    [" Buenos\tAires\n", 11],
    [" \u00a0\r\n", 0],
    ["👨‍👩‍👧‍👦!", 2],
  ])("counts visible graphemes in %j", (value, count) => {
    expect(countAlphabetAnswerCharacters(value)).toBe(count);
  });
  it("shows the principal holes, then fills them without imposing a maximum", () => {
    expect(alphabetAnswerSlots("", 12).filter((slot) => slot.kind === "empty")).toHaveLength(12);
    const partial = alphabetAnswerSlots("archi", 12);
    expect(partial.filter((slot) => slot.kind === "filled")).toHaveLength(5);
    expect(partial.filter((slot) => slot.kind === "empty")).toHaveLength(7);
    expect(partial.filter((slot) => slot.kind === "empty" && slot.active)).toHaveLength(1);
    const complete = alphabetAnswerSlots("archipiélago", 12);
    expect(complete.filter((slot) => slot.kind === "empty")).toHaveLength(0);
    expect(complete.at(-1)).toEqual({ kind: "caret" });
    const longer = alphabetAnswerSlots("archipiélagos", 12);
    expect(longer.filter((slot) => slot.kind === "filled")).toHaveLength(13);
    expect(longer.filter((slot) => slot.kind === "empty")).toHaveLength(0);
  });
  it("collapses whitespace visually without counting it or changing the text", () => {
    const value = "A  \t B ";
    const slots = alphabetAnswerSlots(value, 4);
    expect(slots.filter((slot) => slot.kind === "space")).toHaveLength(2);
    expect(slots.filter((slot) => slot.kind === "empty")).toHaveLength(2);
    expect(value).toBe("A  \t B ");
  });
  it("keeps an append position when a legacy question has no length", () => {
    const slots = alphabetAnswerSlots("libre", null);
    expect(slots.filter((slot) => slot.kind === "filled")).toHaveLength(5);
    expect(slots.at(-1)).toEqual({ kind: "empty", active: true });
  });
  it("deletes a whole emoji or decomposed accented letter while retaining whitespace", () => {
    expect(deleteLastAlphabetCharacter("a 👨‍👩‍👧‍👦")).toBe("a ");
    expect(deleteLastAlphabetCharacter("Na\u0301")).toBe("N");
    expect(deleteLastAlphabetCharacter("")).toBe("");
  });
});
