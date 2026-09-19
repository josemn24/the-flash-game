export const ESTIMATION_MAX_UNIT_LENGTH = 120;

export type EstimationConfiguration = {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly initialValue: number;
  readonly unit: string;
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isStepAligned(value: number, min: number, step: number): boolean {
  if (!isFiniteNumber(value) || !isFiniteNumber(min) || !isFiniteNumber(step) || step <= 0) {
    return false;
  }
  const quotient = (value - min) / step;
  return Math.abs(quotient - Math.round(quotient)) <= 1e-9 * Math.max(1, Math.abs(quotient));
}

export function isValidEstimationConfiguration(input: {
  readonly min: unknown;
  readonly max: unknown;
  readonly step: unknown;
  readonly initialValue: unknown;
  readonly unit: unknown;
}): input is EstimationConfiguration {
  return (
    isFiniteNumber(input.min) &&
    isFiniteNumber(input.max) &&
    input.min < input.max &&
    isFiniteNumber(input.step) &&
    input.step > 0 &&
    isFiniteNumber(input.initialValue) &&
    input.initialValue >= input.min &&
    input.initialValue <= input.max &&
    isStepAligned(input.initialValue, input.min, input.step) &&
    typeof input.unit === "string" &&
    input.unit.trim().length > 0 &&
    input.unit.length <= ESTIMATION_MAX_UNIT_LENGTH
  );
}

export function isValidEstimationAnswer(
  answer: unknown,
  input: { readonly min: number; readonly max: number; readonly step: number },
): answer is number {
  return (
    isFiniteNumber(answer) &&
    answer >= input.min &&
    answer <= input.max &&
    isStepAligned(answer, input.min, input.step)
  );
}

export function isValidEstimationSolution(
  correctAnswer: unknown,
  tolerance: unknown,
  input: { readonly min: number; readonly max: number },
): correctAnswer is number {
  return (
    isFiniteNumber(correctAnswer) &&
    correctAnswer >= input.min &&
    correctAnswer <= input.max &&
    isFiniteNumber(tolerance) &&
    tolerance >= 0
  );
}
