import { definition } from "./definition";

import type { ServerEstimationQuestion } from "@/types/gameplay/challenge";

import { isValidEstimationConfiguration } from "@/lib/estimation";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import {
  ServerFlashQuestionError,
  publicEnvelope,
  questionMedia,
  type PublicReadContext,
} from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "estimation" }> {
  const { value, base } = publicEnvelope(context, definition);
  const configuration = {
    min: value.min,
    max: value.max,
    step: value.step,
    initialValue: value.initialValue,
    unit: value.unit,
  };
  const media = questionMedia(value);
  if (!isValidEstimationConfiguration(configuration) || (media !== undefined && !media)) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "estimation",
    min: configuration.min as number,
    max: configuration.max as number,
    step: configuration.step as number,
    initialValue: configuration.initialValue as number,
    unit: configuration.unit as string,
    ...(media ? { media } : {}),
  } satisfies ServerEstimationQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
