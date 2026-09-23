import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  callFlashRead,
  isFlashReadRow,
  isFlashResultRow,
  supabaseFlashQueries,
  toRoomContext,
  type FlashReadRow,
  type FlashResultRow,
} from "@/infrastructure/supabase/flashQueries";
import { resolveCompetitiveQuestionPayload } from "@/infrastructure/supabase/questionAssetRuntime";
import type { ServerFlashTerminalReview, ServerPyramidChallenge } from "@/types/gameplay/challenge";
import { getCurrentViewerProfile } from "@/server/profile";

type PyramidReadRow = Omit<FlashReadRow, "challenge_mode" | "question_count"> & {
  challenge_mode: "pyramid";
  challenge_version_number: number;
  question_count: number;
  level_id: string;
  level_label: string;
  briefing_title: string;
  briefing_format: string;
  briefing_description: string;
};

function isPyramidReadRow(value: unknown): value is PyramidReadRow {
  if (!isFlashReadRow(value) || value.challenge_mode !== "pyramid") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.challenge_version_number === "number" &&
    Number.isSafeInteger(row.challenge_version_number) &&
    row.challenge_version_number > 0 &&
    typeof row.level_id === "string" &&
    row.level_id.trim().length > 0 &&
    typeof row.level_label === "string" &&
    row.level_label.trim().length > 0 &&
    typeof row.briefing_title === "string" &&
    row.briefing_title.trim().length > 0 &&
    typeof row.briefing_format === "string" &&
    row.briefing_format.trim().length > 0 &&
    typeof row.briefing_description === "string" &&
    row.briefing_description.trim().length > 0
  );
}

function terminalReviewRow(row: FlashResultRow): ServerFlashTerminalReview {
  return {
    challengeItemId: row.challenge_item_id,
    publicPayload: row.public_payload,
    solutionPayload: row.solution_payload,
  };
}

export class SupabasePyramidQueries {
  async getTerminalReview(attemptId: string): Promise<ServerFlashTerminalReview[]> {
    const rows = (
      await callFlashRead("get_my_pyramid_result", { target_attempt_id: attemptId })
    ).filter(isFlashResultRow);
    if (!rows.length) return [];
    const client = await createClient();
    const { data } = await client.auth.getUser();
    return Promise.all(
      rows.map(async (row) => {
        const review = terminalReviewRow(row);
        return data.user
          ? {
              ...review,
              publicPayload: await resolveCompetitiveQuestionPayload({
                authUserId: data.user.id,
                attemptId,
                publicPayload: review.publicPayload,
              }),
            }
          : review;
      }),
    );
  }

  async getPlayable(roomKey: string, publicationId: string) {
    const viewer = await getCurrentViewerProfile();
    if (!viewer) return null;
    const rows = (
      await callFlashRead("get_my_pyramid_challenge", {
        target_room_slug: roomKey,
        target_publication_id: publicationId,
      })
    ).filter(isPyramidReadRow);
    const first = rows[0];
    if (
      !first ||
      rows.length !== 7 ||
      first.question_count !== 7 ||
      rows.some((row, index) => row.item_position !== index + 1) ||
      new Set(rows.map((row) => row.level_id)).size !== 7
    ) {
      return null;
    }

    let resultRows: FlashResultRow[] = [];
    if (first.own_attempt_status === "completed" && first.own_attempt_id) {
      resultRows = (
        await callFlashRead("get_my_pyramid_result", {
          target_attempt_id: first.own_attempt_id,
        })
      ).filter(isFlashResultRow);
    }
    const result = resultRows.length ? supabaseFlashQueries.toResult(resultRows) : undefined;
    const terminalReview =
      resultRows.length && first.own_attempt_id
        ? await this.getTerminalReview(first.own_attempt_id)
        : undefined;

    const challenge: ServerPyramidChallenge = {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "pyramid",
      attemptVersion: first.challenge_version_number,
      availableFrom: first.publication_opens_at,
      availableUntil: first.publication_closes_at,
      levels: rows.map((row) => ({
        id: row.challenge_item_id,
        position: row.item_position,
        levelId: row.level_id,
        label: row.level_label,
        briefing: {
          title: row.briefing_title,
          format: row.briefing_format,
          description: row.briefing_description,
        },
        questionType: row.question_type,
        payloadSchemaVersion: row.payload_schema_version,
        timeLimitMs: row.time_limit_ms,
        points: row.item_points,
      })),
      maxScore: first.challenge_max_score,
    };

    return {
      challenge,
      roomContext: toRoomContext(first, viewer.playerId, result),
      socialSnapshot: {
        currentPlayer: {
          id: viewer.playerId,
          displayName: viewer.name,
          initials: viewer.name.slice(0, 2).toUpperCase(),
          tone: "social" as const,
        },
        players: [],
        peers: [],
      },
      gameplayPersistence: "server" as const,
      ...(terminalReview ? { terminalReview } : {}),
    };
  }
}

export const supabasePyramidQueries = new SupabasePyramidQueries();
