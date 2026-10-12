import "server-only";
import { readTimeTrialResult } from "@/lib/timeTrial";
import type { QueryContext } from "@/types/view-models";
import type {
  ServerTimeTrialChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import {
  callFlashRead,
  isFlashReadRow,
  isFlashResultRow,
  supabaseFlashQueries,
  toRoomContext,
  type GeneratedCompetitiveReadRow,
} from "./flashQueries";
import { validateCompetitiveRows } from "./competitiveReadProjection";

type ReadRow = GeneratedCompetitiveReadRow<"get_my_time_trial_challenge">;
function isReadRow(value: unknown): value is ReadRow {
  if (!isFlashReadRow<"get_my_time_trial_challenge">(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    row.challenge_mode === "time-trial" &&
    row.question_type === "queens" &&
    typeof row.global_time_limit_ms === "number" &&
    Number.isSafeInteger(row.global_time_limit_ms) &&
    row.global_time_limit_ms > 0 &&
    row.global_time_limit_ms <= 2147483647 &&
    row.global_time_limit_ms % 1000 === 0
  );
}

export class SupabaseTimeTrialQueries {
  async getTerminalReview(attemptId: string): Promise<ServerFlashTerminalReview[]> {
    const rows = await callFlashRead("get_my_time_trial_result", { target_attempt_id: attemptId });
    return rows.map((row) => ({
      challengeItemId: row.challenge_item_id,
      publicPayload: row.public_payload,
      solutionPayload: row.solution_payload,
    }));
  }

  async getPlayableFromRows(raw: readonly unknown[], context: QueryContext) {
    const rows = validateCompetitiveRows(raw, isReadRow);
    const first = rows[0];
    if (!first || first.publication_status === "cancelled") return null;
    if (
      rows.length !== first.question_count ||
      rows.reduce((sum, row) => sum + row.item_points, 0) !== 100
    )
      throw new Error("Invalid Contrarreloj sequence");
    const resultRows =
      first.own_attempt_status === "completed" && first.own_attempt_id
        ? await callFlashRead("get_my_time_trial_result", {
            target_attempt_id: first.own_attempt_id,
          })
        : [];
    const answeredRows = resultRows.filter(isFlashResultRow<"get_my_time_trial_result">);
    const result = answeredRows.length ? supabaseFlashQueries.toResult(answeredRows) : undefined;
    const timeTrial = resultRows[0] ? readTimeTrialResult(resultRows[0].time_trial) : undefined;
    const challenge: ServerTimeTrialChallenge = {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "time-trial",
      timeLimitMs: first.global_time_limit_ms,
      maxScore: first.challenge_max_score,
      slots: rows.map((row) => ({
        id: row.challenge_item_id,
        position: row.item_position,
        questionType: row.question_type,
        payloadSchemaVersion: row.payload_schema_version,
        timeLimitMs: row.time_limit_ms,
        points: row.item_points,
      })),
    };
    return {
      challenge,
      roomContext: {
        ...toRoomContext(first, context.viewer.playerId, result),
        ...(timeTrial ? { timeTrial } : {}),
      },
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
      ...(resultRows.length
        ? {
            terminalReview: resultRows.map((row) => ({
              challengeItemId: row.challenge_item_id,
              publicPayload: row.public_payload,
              solutionPayload: row.solution_payload,
            })),
          }
        : {}),
    };
  }
}

export const supabaseTimeTrialQueries = new SupabaseTimeTrialQueries();
