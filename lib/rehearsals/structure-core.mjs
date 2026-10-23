const count = (value) => (Array.isArray(value) ? value.length : 0);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const grid = (p) => {
  const g = object(p.grid);
  return { rows: g.rows, columns: g.columns };
};
/** Explicit, exhaustive mechanics allowlist. Content and solutions are not compared. */
export const mechanics = {
  "multiple-choice": (p) => ({
    options: count(p.options),
    media: Boolean(p.media),
    visual: Boolean(p.promptVisual),
  }),
  "odd-one-out": (p) => ({ items: count(p.items) }),
  matching: (p) => ({ left: count(p.leftItems), right: count(p.rightItems) }),
  "connect-pairs": (p) => ({
    ...grid(p),
    pairs: count(p.pairs),
    requireFullCoverage: p.requireFullCoverage,
  }),
  "true-false": () => ({}),
  "short-text": () => ({}),
  "progressive-clues": (p) => ({
    clues: Array.isArray(p.clues) ? p.clues.length : p.clueCount,
    penalty: p.cluePenalty,
  }),
  "progressive-image": (p) => ({ revealDurationMs: p.revealDurationMs }),
  "heat-map": (p) => ({
    width: object(p.surface).width,
    height: object(p.surface).height,
  }),
  ordering: (p) => ({ items: count(p.items) }),
  classification: (p) => ({ items: count(p.items), categories: count(p.categories) }),
  "logic-matrix": (p) => ({
    cells: count(p.cells),
    missing: Array.isArray(p.cells) ? p.cells.filter((c) => c === null).length : 0,
    pieces: count(p.pieces),
    options: count(p.optionIds),
    showPieceLabels: p.showPieceLabels ?? false,
  }),
  queens: (p) => ({ ...grid(p), prefilled: count(p.prefilledQueens) }),
  zip: (p) => ({ ...grid(p), checkpoints: count(p.checkpoints) }),
  escape: (p) => ({
    ...grid(p),
    exitSide: object(object(p.grid).exit).side,
    blocks: Array.isArray(p.initialBlocks)
      ? p.initialBlocks
          .map((b) => {
            const v = object(b);
            return `${v.kind}:${v.orientation}:${v.length}`;
          })
          .sort()
      : [],
  }),
  anagram: (p) => ({ tiles: count(p.tiles) }),
  "word-hashtag": (p) => ({ ...grid(p), maxMoves: p.maxMoves }),
  "word-search": (p) => ({
    ...grid(p),
    targets: count(p.targets),
    wordLengths: Array.isArray(p.targets)
      ? p.targets
          .map((t) => Array.from(String(t.word).normalize("NFC")).length)
          .sort((a, b) => a - b)
      : [],
  }),
  "mini-wordle": (p) => ({
    wordLength: p.wordLength,
    maxAttempts: p.maxAttempts,
  }),
  "logic-code": (p) => ({ codeLength: p.codeLength, clues: count(p.clues) }),
  estimation: (p) => ({
    min: p.min,
    max: p.max,
    step: p.step,
    initialValue: p.initialValue,
    media: Boolean(p.media),
  }),
};
