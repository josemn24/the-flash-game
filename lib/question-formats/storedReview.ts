import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { PracticeQuestion } from "@/types/gameplay/practice";
import { readPublic as readMiniWordle } from "./mini-wordle/public";
import { questionWithSolution as miniWordleWithSolution } from "./mini-wordle/review";
import { imageSurface, questionMedia } from "./public-common";
import { readPublic as readShortText } from "./short-text/public";
import { questionWithSolution as shortTextWithSolution } from "./short-text/review";
import { readResolvedStoredQuestion } from "./storedRegistry";

/** Reads an authorized, persisted review using the same per-format storage validators. */
export type StoredReviewContext = StoredQuestionContext & {
  publicRepresentation: "authorized-runtime";
};

export function readStoredReviewQuestion(context: StoredReviewContext): PracticeQuestion {
  const resolved = readResolvedStoredQuestion(context);
  const publicPayload = context.publicPayload as Record<string, unknown>;
  if (resolved.type === "short-text") {
    return shortTextWithSolution(
      readShortText({
        id: context.receiptId,
        payload: publicPayload,
        timeLimitMs: context.timeLimitMs,
        points: context.itemPoints,
        payloadSchemaVersion: context.payloadSchemaVersion,
        mode: context.mode,
      }),
      {
        challengeItemId: context.receiptId,
        publicPayload: context.publicPayload,
        solutionPayload: context.solutionPayload,
      },
    );
  }
  if (resolved.type === "heat-map" || resolved.type === "progressive-image") {
    return { ...resolved, surface: imageSurface(publicPayload) };
  }
  if (resolved.type === "mini-wordle") {
    return miniWordleWithSolution(
      {
        ...readMiniWordle({
          id: context.receiptId,
          payload: publicPayload,
          timeLimitMs: context.timeLimitMs,
          points: context.itemPoints,
          payloadSchemaVersion: context.payloadSchemaVersion,
          mode: context.mode,
        }),
        tags: resolved.tags,
      },
      {
        challengeItemId: context.receiptId,
        publicPayload: context.publicPayload,
        solutionPayload: context.solutionPayload,
      },
    );
  }
  if (resolved.type === "logic-matrix") {
    return {
      ...resolved,
      showPieceLabels:
        typeof publicPayload.showPieceLabels === "boolean"
          ? publicPayload.showPieceLabels
          : undefined,
    };
  }
  if (resolved.type === "multiple-choice" || resolved.type === "estimation") {
    const media = questionMedia(publicPayload);
    return {
      ...resolved,
      media: media ? { ...(publicPayload.media as Record<string, unknown>), ...media } : undefined,
      ...(typeof publicPayload.context === "string" && publicPayload.context
        ? { questionContext: publicPayload.context }
        : {}),
    };
  }
  return {
    ...resolved,
    ...(typeof publicPayload.context === "string" && publicPayload.context
      ? { questionContext: publicPayload.context }
      : {}),
  };
}
