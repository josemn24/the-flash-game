import type {
  AnswerValue,
  EscapeAnswer,
  EscapeBlock,
  EscapeMove,
  EscapeQuestion,
} from "@/types/game";

export type EscapeReplayResult = {
  valid: boolean;
  blocks: EscapeBlock[];
  appliedMoves: number;
  escaped: boolean;
  errorIndex: number | null;
};

function isIntegerInRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function blockStart(block: EscapeBlock) {
  return block.orientation === "horizontal" ? block.column : block.row;
}

function blockCells(block: EscapeBlock) {
  return Array.from({ length: block.length }, (_, offset) => ({
    row: block.row + (block.orientation === "vertical" ? offset : 0),
    column: block.column + (block.orientation === "horizontal" ? offset : 0),
  }));
}

function cellKey(row: number, column: number) {
  return `${row}:${column}`;
}

function occupiedCells(blocks: EscapeBlock[], excludedBlockId?: string) {
  const occupied = new Set<string>();
  for (const block of blocks) {
    if (block.id === excludedBlockId) continue;
    for (const cell of blockCells(block)) occupied.add(cellKey(cell.row, cell.column));
  }
  return occupied;
}

export function isEscapeAnswer(answer: AnswerValue | null): answer is EscapeAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "moves" in answer &&
    Array.isArray(answer.moves) &&
    answer.moves.every(
      (move) =>
        move !== null &&
        typeof move === "object" &&
        "blockId" in move &&
        "from" in move &&
        "to" in move &&
        typeof move.blockId === "string" &&
        Number.isInteger(move.from) &&
        Number.isInteger(move.to),
    )
  );
}

export function getEscapeLegalDestinations(
  question: EscapeQuestion,
  blocks: EscapeBlock[],
  blockId: string,
) {
  const block = blocks.find((candidate) => candidate.id === blockId);
  if (!block) return [];

  const current = blockStart(block);
  const maximum =
    (block.orientation === "horizontal" ? question.grid.columns : question.grid.rows) -
    block.length;
  const occupied = occupiedCells(blocks, blockId);
  const destinations: number[] = [];

  for (let destination = 0; destination <= maximum; destination += 1) {
    if (destination === current) continue;
    const sweptStart = Math.min(destination, current);
    const sweptEnd = Math.max(destination, current) + block.length - 1;
    let clear = true;

    for (let position = sweptStart; position <= sweptEnd; position += 1) {
      const row = block.orientation === "horizontal" ? block.row : position;
      const column = block.orientation === "horizontal" ? position : block.column;
      if (occupied.has(cellKey(row, column))) {
        clear = false;
        break;
      }
    }

    if (clear) destinations.push(destination);
  }

  return destinations;
}

export function applyEscapeMove(
  question: EscapeQuestion,
  blocks: EscapeBlock[],
  move: EscapeMove,
): EscapeBlock[] | null {
  const blockIndex = blocks.findIndex((block) => block.id === move.blockId);
  if (blockIndex < 0) return null;
  const block = blocks[blockIndex];
  if (blockStart(block) !== move.from) return null;
  if (!getEscapeLegalDestinations(question, blocks, block.id).includes(move.to)) return null;

  const nextBlocks = blocks.map((candidate) => ({ ...candidate }));
  nextBlocks[blockIndex] = {
    ...block,
    ...(block.orientation === "horizontal" ? { column: move.to } : { row: move.to }),
  };
  return nextBlocks;
}

export function reverseEscapeMove(
  question: EscapeQuestion,
  blocks: EscapeBlock[],
  move: EscapeMove,
) {
  return applyEscapeMove(question, blocks, {
    blockId: move.blockId,
    from: move.to,
    to: move.from,
  });
}

export function isEscapeSolved(question: EscapeQuestion, blocks: EscapeBlock[]) {
  const target = blocks.find((block) => block.kind === "target");
  return Boolean(
    target &&
    target.orientation === "horizontal" &&
    target.row === question.grid.exit.row &&
    target.column === question.grid.columns - target.length,
  );
}

export function replayEscapeMoves(
  question: EscapeQuestion,
  moves: EscapeMove[],
): EscapeReplayResult {
  let blocks = question.initialBlocks.map((block) => ({ ...block }));

  for (let index = 0; index < moves.length; index += 1) {
    const nextBlocks = applyEscapeMove(question, blocks, moves[index]);
    if (!nextBlocks) {
      return {
        valid: false,
        blocks,
        appliedMoves: index,
        escaped: isEscapeSolved(question, blocks),
        errorIndex: index,
      };
    }
    blocks = nextBlocks;
  }

  return {
    valid: true,
    blocks,
    appliedMoves: moves.length,
    escaped: isEscapeSolved(question, blocks),
    errorIndex: null,
  };
}

export function isValidEscapeConfiguration(question: EscapeQuestion) {
  if (
    question.grid.rows !== 6 ||
    question.grid.columns !== 6 ||
    question.grid.exit.side !== "right" ||
    !isIntegerInRange(question.grid.exit.row, 0, question.grid.rows - 1) ||
    !Number.isInteger(question.optimalMoves) ||
    question.optimalMoves <= 0 ||
    question.referenceSolution.length !== question.optimalMoves ||
    question.initialBlocks.length === 0
  ) {
    return false;
  }

  const ids = new Set<string>();
  const occupied = new Set<string>();
  let target: EscapeBlock | null = null;

  for (const block of question.initialBlocks) {
    if (
      !block.id.trim() ||
      ids.has(block.id) ||
      (block.kind !== "target" && block.kind !== "obstacle") ||
      (block.orientation !== "horizontal" && block.orientation !== "vertical") ||
      (block.length !== 2 && block.length !== 3) ||
      !Number.isInteger(block.row) ||
      !Number.isInteger(block.column) ||
      block.row < 0 ||
      block.column < 0 ||
      block.row + (block.orientation === "vertical" ? block.length : 1) > question.grid.rows ||
      block.column + (block.orientation === "horizontal" ? block.length : 1) > question.grid.columns
    ) {
      return false;
    }

    ids.add(block.id);
    if (block.kind === "target") {
      if (target) return false;
      target = block;
    }

    for (const cell of blockCells(block)) {
      const key = cellKey(cell.row, cell.column);
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }

  if (
    !target ||
    target.orientation !== "horizontal" ||
    target.row !== question.grid.exit.row ||
    isEscapeSolved(question, question.initialBlocks)
  ) {
    return false;
  }

  const solution = replayEscapeMoves(question, question.referenceSolution);
  return solution.valid && solution.escaped;
}
