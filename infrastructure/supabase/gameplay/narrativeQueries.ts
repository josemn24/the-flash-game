import { validateCompetitiveRows } from "./competitiveReadProjection";
import {
  competitivePerformanceObserver,
  countCompetitiveDatabaseCall,
} from "@/infrastructure/observability/competitivePerformance";
import "server-only";

import { competitiveQuestionTypesFor } from "@/lib/question-formats/definitions";
import type {
  PublicFunctionArgs,
  PublicFunctionRow,
  RawRpcResponse,
} from "@/infrastructure/supabase/rpcTypes";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import { resolveCompetitiveQuestionPayload } from "@/infrastructure/supabase/assets/questionAssetRuntime";
import type {
  AnswerResult,
  NarrativeReactionMap,
  NarrativeScene,
  RoomChallengeResult,
  ServerFlashChallenge,
  ServerFlashTerminalReview,
  ServerNarrativeBeat,
  ServerNarrativeChallenge,
  ServerNarrativeStep,
} from "@/types/gameplay";
import type { GameRoomContext, QueryContext } from "@/types/view-models";
import type { CompetitiveChallengePageModel } from "@/types/view-models";

type NarrativeReadRow = PublicFunctionRow<"get_my_narrative_challenge">;
type NarrativeResultRow = PublicFunctionRow<"get_my_narrative_result">;

const serverQuestionTypes = new Set<ServerFlashChallenge["slots"][number]["questionType"]>(
  competitiveQuestionTypesFor(
    "narrative",
  ) as ServerFlashChallenge["slots"][number]["questionType"][],
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTextBlock(value: unknown): value is NarrativeScene["blocks"][number] {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.text !== "string") {
    return false;
  }
  if (value.type === "dialogue") return typeof value.speaker === "string";
  return value.type === "narration" || value.type === "emphasis";
}

function isScene(value: unknown): value is NarrativeScene {
  if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.blocks)) {
    return false;
  }
  return value.blocks.every(isTextBlock);
}

function isReactionMap(value: unknown): value is NarrativeReactionMap {
  if (!isRecord(value)) return false;
  return ["correct", "incorrect", "timeout"].every(
    (outcome) => Array.isArray(value[outcome]) && value[outcome].every(isTextBlock),
  );
}

function narrativeStep(
  value: unknown,
  itemIdByQuestionSlug: ReadonlyMap<string, string>,
): ServerNarrativeStep | null {
  if (!isRecord(value) || (value.type !== "scene" && value.type !== "question")) return null;
  if (value.type === "scene") {
    return isScene(value.scene) ? { type: "scene", scene: value.scene } : null;
  }
  if (typeof value.questionSlug !== "string") return null;
  const questionId = itemIdByQuestionSlug.get(value.questionSlug);
  if (!questionId) return null;
  return {
    type: "question",
    questionId,
    ...(isReactionMap(value.reactions) ? { reactions: value.reactions } : {}),
  };
}

function narrativeConfig(
  value: unknown,
  itemIdByQuestionSlug: ReadonlyMap<string, string>,
): { prologue: NarrativeScene; beats: ServerNarrativeBeat[] } | null {
  if (!isRecord(value) || !isScene(value.prologue) || !Array.isArray(value.beats)) return null;
  const beats: ServerNarrativeBeat[] = [];
  for (const beat of value.beats) {
    if (!isRecord(beat) || typeof beat.id !== "string" || typeof beat.title !== "string") {
      return null;
    }
    if (!Array.isArray(beat.steps)) return null;
    const steps = beat.steps.map((step) => narrativeStep(step, itemIdByQuestionSlug));
    if (steps.some((step): step is null => step === null)) return null;
    beats.push({ id: beat.id, title: beat.title, steps: steps as ServerNarrativeStep[] });
  }
  return { prologue: value.prologue, beats };
}

function isNarrativeReadRow(value: unknown): value is NarrativeReadRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.room_id === "string" &&
    typeof value.room_slug === "string" &&
    typeof value.room_title === "string" &&
    typeof value.publication_id === "string" &&
    typeof value.challenge_slug === "string" &&
    value.challenge_mode === "narrative" &&
    typeof value.challenge_mode_config === "object" &&
    typeof value.challenge_item_id === "string" &&
    typeof value.item_position === "number" &&
    typeof value.question_slug === "string" &&
    typeof value.question_type === "string" &&
    serverQuestionTypes.has(
      value.question_type as ServerFlashChallenge["slots"][number]["questionType"],
    ) &&
    typeof value.payload_schema_version === "number" &&
    typeof value.time_limit_ms === "number" &&
    typeof value.item_points === "number"
  );
}

function isNarrativeResultRow(value: unknown): value is NarrativeResultRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.attempt_id === "string" &&
    typeof value.challenge_item_id === "string" &&
    typeof value.item_position === "number" &&
    typeof value.question_type === "string" &&
    typeof value.public_payload === "object" &&
    typeof value.solution_payload === "object" &&
    typeof value.attempt_score === "number"
  );
}

async function callNarrativeRead<
  Name extends "get_my_narrative_challenge" | "get_my_narrative_result",
>(functionName: Name, args: PublicFunctionArgs<Name>) {
  const supabase = await createClient();
  countCompetitiveDatabaseCall("rpcCalls");
  const response = await competitivePerformanceObserver.measure(
    functionName.endsWith("_challenge") ? "challenge.initial" : "challenge.enrichment",
    () => supabase.rpc(functionName, args),
  );
  const { data, error } = response as RawRpcResponse<typeof response>;
  if (error) throw new Error(`Supabase narrative read failed (${functionName}): ${error.message}`);
  return Array.isArray(data) ? data : [];
}

function toRoomContext(
  row: NarrativeReadRow,
  viewerId: string,
  result?: RoomChallengeResult,
): GameRoomContext {
  return {
    roomId: row.room_slug,
    roomTitle: row.room_title,
    returnTo: `/salas/${row.room_slug}`,
    memberId: viewerId,
    availabilityStatus: "available",
    attemptStatus:
      row.own_attempt_status === "completed"
        ? "completed"
        : row.own_attempt_status === "in_progress"
          ? "inProgress"
          : row.own_attempt_status === "abandoned" || row.own_attempt_status === "invalidated"
            ? "notCompleted"
            : "available",
    gameplayPersistence: "server",
    ...(result ? { result } : {}),
  };
}

function toResult(rows: readonly NarrativeResultRow[]): RoomChallengeResult {
  const first = rows[0]!;
  const answers: AnswerResult[] = rows.map((row) => ({
    questionId: row.challenge_item_id,
    answer: row.answer as unknown as AnswerResult["answer"],
    status: (row.answer_status ?? "unanswered") as AnswerResult["status"],
    isCorrect: row.answer_status === "correct" || row.answer_status === "partial",
    points: row.points ?? 0,
    timeUsed: (row.time_used_ms ?? 0) / 1000,
    ...(row.result_details ? { details: row.result_details as AnswerResult["details"] } : {}),
  }));
  return {
    flashPoints: first.attempt_score,
    completed: true,
    attempt: {
      challengeId: first.scheduled_challenge_id,
      startedAt: first.attempt_started_at,
      playedAt: first.attempt_completed_at,
      flashPoints: first.attempt_score,
      completed: true,
      durationMs: rows.reduce((sum, row) => sum + (row.time_used_ms ?? 0), 0),
      answers,
    },
  };
}

export class SupabaseNarrativeQueries {
  async getPlayable(roomKey: string, publicationId: string, context: QueryContext) {
    return this.getPlayableFromRows(
      await callNarrativeRead("get_my_narrative_challenge", {
        target_room_slug: roomKey,
        target_publication_id: publicationId,
      }),
      context,
    );
  }

  async getPlayableFromRows(rawRows: readonly unknown[], context: QueryContext) {
    const rows = validateCompetitiveRows(rawRows, isNarrativeReadRow);
    const first = rows[0];
    if (first && rows.length !== first.question_count) {
      throw new Error("Incomplete competitive challenge rows");
    }
    if (!first || rows.length !== first.question_count || first.challenge_mode !== "narrative") {
      return null;
    }

    const itemIdByQuestionSlug = new Map(
      rows.map((row) => [row.question_slug, row.challenge_item_id]),
    );
    const config = narrativeConfig(first.challenge_mode_config, itemIdByQuestionSlug);
    if (!config) return null;

    const challenge: ServerNarrativeChallenge = {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "narrative",
      maxScore: first.challenge_max_score,
      prologue: config.prologue,
      beats: config.beats,
      slots: rows.map((row) => ({
        id: row.challenge_item_id,
        position: row.item_position,
        questionType: row.question_type as ServerFlashChallenge["slots"][number]["questionType"],
        payloadSchemaVersion: row.payload_schema_version,
        timeLimitMs: row.time_limit_ms,
        points: row.item_points,
      })),
    };

    let resultRows: NarrativeResultRow[] = [];
    if (first.own_attempt_status === "completed" && first.own_attempt_id) {
      resultRows = (
        await callNarrativeRead("get_my_narrative_result", {
          target_attempt_id: first.own_attempt_id,
        })
      ).filter(isNarrativeResultRow);
    }
    const result = resultRows.length ? toResult(resultRows) : undefined;
    let terminalReview: ServerFlashTerminalReview[] | undefined = resultRows.length
      ? resultRows.map((row) => ({
          challengeItemId: row.challenge_item_id,
          publicPayload: row.public_payload,
          solutionPayload: row.solution_payload,
        }))
      : undefined;
    if (terminalReview && first.own_attempt_id) {
      const authClient = await createClient();
      const { data: authData } = await authClient.auth.getUser();
      if (authData.user) {
        terminalReview = await Promise.all(
          terminalReview.map(async (review) => ({
            ...review,
            publicPayload: await resolveCompetitiveQuestionPayload({
              authUserId: authData.user!.id,
              attemptId: first.own_attempt_id!,
              publicPayload: review.publicPayload,
            }),
          })),
        );
      }
    }

    return {
      challenge,
      roomContext: toRoomContext(first, context.viewer.playerId, result),
      socialSnapshot: {
        currentPlayer: {
          id: context.viewer.playerId,
          displayName: context.viewer.name,
          initials: context.viewer.name.slice(0, 2).toUpperCase(),
          tone: "social" as const,
        },
        players: [],
        peers: [],
      },
      gameplayPersistence: "server" as const,
      ...(terminalReview ? { terminalReview } : {}),
    } satisfies CompetitiveChallengePageModel;
  }

  async getTerminalReview(attemptId: string) {
    return (
      await callNarrativeRead("get_my_narrative_result", {
        target_attempt_id: attemptId,
      })
    )
      .filter(isNarrativeResultRow)
      .map((row) => ({
        challengeItemId: row.challenge_item_id,
        publicPayload: row.public_payload,
        solutionPayload: row.solution_payload,
      }));
  }
}

export const supabaseNarrativeQueries = new SupabaseNarrativeQueries();
