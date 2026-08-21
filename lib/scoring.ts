export type { EvaluationInput, ScoringPolicyId } from "@/lib/scoringCore/types";
export {
  calculateAnswerScore,
  calculateTotalScore,
  evaluateAnswer,
  getTimedOutAnswer,
  isAnswerCorrect,
} from "@/lib/scoringCore/engine";
export { QUESTION_SCORING_POLICY, SCORING } from "@/lib/scoringCore/registry";
export { calculateQuestionScore } from "@/lib/scoringCore/shared";
export { isValidAnagramConfiguration } from "@/lib/scoringCore/questions/anagram";
export {
  calculateWordHashtagMetrics,
  isValidWordHashtagConfiguration,
  isWordHashtagAnswer,
} from "@/lib/wordHashtag";
export { isClassificationAnswer } from "@/lib/scoringCore/questions/classification";
export { isConnectPairsAnswer } from "@/lib/scoringCore/questions/connectPairs";
export {
  calculateErrorReconstructionMetrics,
  isErrorReconstructionAnswer,
  isValidErrorReconstructionConfiguration,
} from "@/lib/scoringCore/questions/errorReconstruction";
export {
  calculateFlashMemoryMetrics,
  isFlashMemoryAnswer,
  isValidFlashMemoryConfiguration,
} from "@/lib/scoringCore/questions/flashMemory";
export { calculateHeatMapMetrics, isHeatMapAnswer } from "@/lib/scoringCore/questions/heatMap";
export {
  calculateImageLabelingMetrics,
  isImageLabelingAnswer,
  isValidImageLabelingConfiguration,
} from "@/lib/scoringCore/questions/imageLabeling";
export { calculateMatchingMetrics, isMatchingAnswer } from "@/lib/scoringCore/questions/matching";
export {
  calculateMemoryPairsMetrics,
  isMemoryPairsAnswer,
  isValidMemoryPairsConfiguration,
} from "@/lib/scoringCore/questions/memoryPairs";
export {
  calculateMiniNonogramMetrics,
  isMiniNonogramAnswer,
  isValidMiniNonogramConfiguration,
} from "@/lib/scoringCore/questions/miniNonogram";
export {
  calculateMiniSudokuMetrics,
  isMiniSudokuAnswer,
  isValidMiniSudokuConfiguration,
} from "@/lib/scoringCore/questions/miniSudoku";
export {
  calculateQueensMetrics,
  countQueensSolutions,
  getQueensConflicts,
  isQueensAnswer,
  isValidQueensConfiguration,
} from "@/lib/queens";
export {
  calculateMiniWordleMetrics,
  isMiniWordleAnswer,
} from "@/lib/scoringCore/questions/miniWordle";
export { calculateProgressiveCluesMetrics } from "@/lib/scoringCore/questions/progressiveClues";
export {
  findSimonSequenceMismatch,
  isSimonSequenceAnswer,
  isValidSimonSequenceConfiguration,
} from "@/lib/scoringCore/questions/simonSequence";
export {
  isSlidingPuzzleAnswer,
  isValidSlidingPuzzleConfiguration,
} from "@/lib/scoringCore/questions/slidingPuzzle";
export { isTimeMazeAnswer } from "@/lib/scoringCore/questions/timeMaze";
export { isZipAnswer } from "@/lib/scoringCore/questions/zip";
export { isPipesAnswer } from "@/lib/pipes";
export { calculateEstimationMetrics } from "@/lib/scoringCore/questions/estimation";
export { evaluateEscape } from "@/lib/scoringCore/questions/escape";
export { isEscapeAnswer, isValidEscapeConfiguration } from "@/lib/escape";
export { isValidLogicMatrixConfiguration } from "@/lib/scoringCore/questions/logicMatrix";
