import type { ConnectPairsAnswer, ConnectPairsQuestion } from "@/types/game";

export const CONNECT_PAIRS_ROWS = 5;
export const CONNECT_PAIRS_COLUMNS = 5;
export const CONNECT_PAIRS_CELL_COUNT = CONNECT_PAIRS_ROWS * CONNECT_PAIRS_COLUMNS;
export const CONNECT_PAIRS_MIN_PAIRS = 3;
export const CONNECT_PAIRS_MAX_PAIRS = 5;

export type ConnectPairsMetrics = {
  valid: boolean;
  connectedPairs: number;
  totalPairs: number;
  coveredCells: number;
  totalCells: number;
  coverageRatio: number;
  pairCompletionRatio: number;
  coverageScore: number;
  conflicts: number;
  complete: boolean;
  exact: boolean;
};

export type ConnectPairsCellSelectionResult = {
  paths: Record<string, number[]>;
  activePairId: string;
  message: string;
  changed: boolean;
};

function isBoardIndex(index: number) {
  return Number.isInteger(index) && index >= 0 && index < CONNECT_PAIRS_CELL_COUNT;
}

function areOrthogonalNeighbors(left: number, right: number) {
  const leftRow = Math.floor(left / CONNECT_PAIRS_COLUMNS);
  const rightRow = Math.floor(right / CONNECT_PAIRS_COLUMNS);
  const leftColumn = left % CONNECT_PAIRS_COLUMNS;
  const rightColumn = right % CONNECT_PAIRS_COLUMNS;
  return Math.abs(leftRow - rightRow) + Math.abs(leftColumn - rightColumn) === 1;
}

function pathConnectsEndpoints(path: number[], endpoints: [number, number]) {
  const first = path[0];
  const last = path.at(-1);
  return (
    (first === endpoints[0] && last === endpoints[1]) ||
    (first === endpoints[1] && last === endpoints[0])
  );
}

function isContiguousPath(path: number[]) {
  return path.every((cell, index) => index === 0 || areOrthogonalNeighbors(path[index - 1], cell));
}

function uniquePathCells(path: number[]) {
  return new Set(path).size === path.length;
}

function findPairForCell(question: ConnectPairsQuestion, cell: number) {
  return question.pairs.find((pair) => pair.endpoints.includes(cell));
}

function findRouteForCell(
  question: ConnectPairsQuestion,
  paths: Record<string, number[]>,
  cell: number,
) {
  return question.pairs.find((pair) => (paths[pair.id] ?? []).includes(cell));
}

function canCloseActivePair(
  pair: ConnectPairsQuestion["pairs"][number],
  path: number[],
  cell: number,
) {
  const lastCell = path.at(-1);
  return (
    path.length > 0 &&
    lastCell !== undefined &&
    pair.endpoints.includes(path[0]) &&
    pair.endpoints.includes(cell) &&
    path[0] !== cell &&
    !path.includes(cell) &&
    areOrthogonalNeighbors(lastCell, cell)
  );
}

export function isValidConnectPairsAnswer(answer: unknown): answer is ConnectPairsAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "paths" in answer &&
    answer.paths !== null &&
    typeof answer.paths === "object" &&
    !Array.isArray(answer.paths) &&
    Object.values(answer.paths).every(
      (path) => Array.isArray(path) && path.every((cell) => Number.isInteger(cell)),
    )
  );
}

export function isValidConnectPairsConfiguration(question: ConnectPairsQuestion) {
  const pairIds = question.pairs.map((pair) => pair.id);
  const endpoints = question.pairs.flatMap((pair) => pair.endpoints);
  const solution = { paths: question.solutionPaths };
  const solutionMetrics = calculateConnectPairsMetrics(question, solution, {
    validateQuestion: false,
  });

  return (
    question.grid.rows === CONNECT_PAIRS_ROWS &&
    question.grid.columns === CONNECT_PAIRS_COLUMNS &&
    question.requireFullCoverage === true &&
    question.pairs.length >= CONNECT_PAIRS_MIN_PAIRS &&
    question.pairs.length <= CONNECT_PAIRS_MAX_PAIRS &&
    new Set(pairIds).size === pairIds.length &&
    new Set(endpoints).size === endpoints.length &&
    question.pairs.every(
      (pair) =>
        Boolean(pair.id.trim()) &&
        Boolean(pair.label.trim()) &&
        Boolean(pair.symbol.trim()) &&
        pair.endpoints.length === 2 &&
        pair.endpoints.every(isBoardIndex) &&
        pair.endpoints[0] !== pair.endpoints[1],
    ) &&
    Object.keys(question.solutionPaths).length === question.pairs.length &&
    question.pairs.every((pair) => Array.isArray(question.solutionPaths[pair.id])) &&
    solutionMetrics.valid &&
    solutionMetrics.exact
  );
}

export function calculateConnectPairsMetrics(
  question: ConnectPairsQuestion,
  answer: ConnectPairsAnswer,
  options: { validateQuestion?: boolean } = {},
): ConnectPairsMetrics {
  const totalPairs = question.pairs.length;
  const totalCells = question.grid.rows * question.grid.columns;
  const occupancy = new Map<number, string>();
  let conflicts = 0;
  let connectedPairs = 0;
  let structurallyValid = true;

  if (options.validateQuestion !== false) {
    const pairIds = question.pairs.map((pair) => pair.id);
    const endpoints = question.pairs.flatMap((pair) => pair.endpoints);
    structurallyValid =
      question.grid.rows === CONNECT_PAIRS_ROWS &&
      question.grid.columns === CONNECT_PAIRS_COLUMNS &&
      question.requireFullCoverage === true &&
      question.pairs.length >= CONNECT_PAIRS_MIN_PAIRS &&
      question.pairs.length <= CONNECT_PAIRS_MAX_PAIRS &&
      new Set(pairIds).size === pairIds.length &&
      new Set(endpoints).size === endpoints.length &&
      question.pairs.every((pair) => pair.endpoints.every(isBoardIndex));
  }

  const validPairIds = new Set(question.pairs.map((pair) => pair.id));
  if (Object.keys(answer.paths).some((pairId) => !validPairIds.has(pairId))) {
    structurallyValid = false;
  }

  for (const pair of question.pairs) {
    const path = answer.paths[pair.id] ?? [];
    if (path.length === 0) continue;

    const pathIsValid =
      path.length >= 2 &&
      path.every(isBoardIndex) &&
      uniquePathCells(path) &&
      isContiguousPath(path) &&
      pathConnectsEndpoints(path, pair.endpoints);

    if (!pathIsValid) structurallyValid = false;
    if (pathIsValid) connectedPairs += 1;

    for (const cell of path) {
      const owner = occupancy.get(cell);
      if (owner && owner !== pair.id) {
        conflicts += 1;
        structurallyValid = false;
      } else {
        occupancy.set(cell, pair.id);
      }
    }
  }

  const coveredCells = occupancy.size;
  const coverageRatio = totalCells > 0 ? coveredCells / totalCells : 0;
  const pairCompletionRatio = totalPairs > 0 ? connectedPairs / totalPairs : 0;
  const coverageScore = Math.min(pairCompletionRatio, coverageRatio);
  const complete =
    structurallyValid &&
    connectedPairs === totalPairs &&
    (!question.requireFullCoverage || coveredCells === totalCells);

  return {
    valid: structurallyValid,
    connectedPairs,
    totalPairs,
    coveredCells,
    totalCells,
    coverageRatio,
    pairCompletionRatio,
    coverageScore,
    conflicts,
    complete,
    exact: complete,
  };
}

export function applyConnectPairsCellSelection(
  question: ConnectPairsQuestion,
  paths: Record<string, number[]>,
  activePairId: string,
  cell: number,
): ConnectPairsCellSelectionResult {
  const activePair = question.pairs.find((pair) => pair.id === activePairId) ?? question.pairs[0];
  const activePath = activePair ? (paths[activePair.id] ?? []) : [];
  const endpointPair = findPairForCell(question, cell);

  if (
    activePair &&
    endpointPair?.id === activePair.id &&
    canCloseActivePair(activePair, activePath, cell)
  ) {
    const nextPaths = { ...paths, [activePair.id]: [...activePath, cell] };
    return {
      paths: nextPaths,
      activePairId: activePair.id,
      message: `${activePair.label}: pareja conectada.`,
      changed: true,
    };
  }

  if (
    activePair &&
    endpointPair?.id === activePair.id &&
    activePath.length > 0 &&
    activePair.endpoints.includes(activePath[0]) &&
    activePath[0] !== cell &&
    !activePath.includes(cell)
  ) {
    return {
      paths,
      activePairId,
      message: "Solo puedes avanzar a una casilla ortogonal adyacente.",
      changed: false,
    };
  }

  if (
    activePair &&
    endpointPair &&
    endpointPair.id !== activePair.id &&
    activePath.length > 0 &&
    !pathConnectsEndpoints(activePath, activePair.endpoints)
  ) {
    return {
      paths,
      activePairId,
      message: "No puedes usar el extremo de otra pareja.",
      changed: false,
    };
  }

  if (endpointPair) {
    const existingPath = paths[endpointPair.id] ?? [];
    const existingIndex = existingPath.indexOf(cell);
    if (existingIndex >= 0) {
      return {
        paths: { ...paths, [endpointPair.id]: existingPath.slice(0, existingIndex + 1) },
        activePairId: endpointPair.id,
        message: `${endpointPair.label}: ruta recortada hasta la casilla ${cell + 1}.`,
        changed: true,
      };
    }
    return {
      paths: { ...paths, [endpointPair.id]: [cell] },
      activePairId: endpointPair.id,
      message: `${endpointPair.label}: ruta iniciada.`,
      changed: true,
    };
  }

  const routePair = findRouteForCell(question, paths, cell);
  if (routePair) {
    const existingPath = paths[routePair.id] ?? [];
    const existingIndex = existingPath.indexOf(cell);
    return {
      paths: { ...paths, [routePair.id]: existingPath.slice(0, existingIndex + 1) },
      activePairId: routePair.id,
      message: `${routePair.label}: ruta recortada hasta la casilla ${cell + 1}.`,
      changed: true,
    };
  }

  if (!activePair || activePath.length === 0) {
    return {
      paths,
      activePairId,
      message: "Selecciona un extremo para empezar.",
      changed: false,
    };
  }

  const lastCell = activePath.at(-1);
  if (lastCell === undefined || !areOrthogonalNeighbors(lastCell, cell)) {
    return {
      paths,
      activePairId,
      message: "Solo puedes avanzar a una casilla ortogonal adyacente.",
      changed: false,
    };
  }

  const occupiedByOtherPair = question.pairs.some(
    (pair) => pair.id !== activePair.id && (paths[pair.id] ?? []).includes(cell),
  );
  if (occupiedByOtherPair) {
    return {
      paths,
      activePairId,
      message: "Esa casilla ya pertenece a otra ruta.",
      changed: false,
    };
  }

  const nextPaths = { ...paths, [activePair.id]: [...activePath, cell] };
  return {
    paths: nextPaths,
    activePairId: activePair.id,
    message: `${activePair.label}: ruta extendida a la casilla ${cell + 1}.`,
    changed: true,
  };
}
