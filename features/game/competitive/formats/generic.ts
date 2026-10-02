/** Drafts accepted by the existing generic timeout answer contract. */
export function supportsServerFlashDraft(questionType: string): boolean {
  return ["classification", "estimation", "heat-map", "zip", "escape", "matching"].includes(
    questionType,
  );
}
