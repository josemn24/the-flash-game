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
import type {
  ServerFlashTerminalReview,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import { getCurrentViewerProfile } from "@/server/profile";

type SurvivalReadRow = FlashReadRow & {
  challenge_mode: "survival";
  initial_lives: number;
};

function isSurvivalReadRow(value: unknown): value is SurvivalReadRow {
  return (
    isFlashReadRow(value) &&
    value.challenge_mode === "survival" &&
    typeof (value as Record<string, unknown>).initial_lives === "number" &&
    Number.isSafeInteger((value as Record<string, unknown>).initial_lives) &&
    Number((value as Record<string, unknown>).initial_lives) >= 1
  );
}

function terminalReviewRow(row: FlashResultRow): ServerFlashTerminalReview {
  return {
    challengeItemId: row.challenge_item_id,
    publicPayload: row.public_payload,
    solutionPayload: row.solution_payload,
  };
}

export class SupabaseSurvivalQueries {
  async getTerminalReview(attemptId: string): Promise<ServerFlashTerminalReview[]> {
    const rows = (
      await callFlashRead("get_my_survival_result", { target_attempt_id: attemptId })
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
      await callFlashRead("get_my_survival_challenge", {
        target_room_slug: roomKey,
        target_publication_id: publicationId,
      })
    ).filter(isSurvivalReadRow);
    const first = rows[0];
    if (
      !first ||
      rows.length !== first.question_count ||
      first.initial_lives > first.question_count
    ) {
      return null;
    }

    let resultRows: FlashResultRow[] = [];
    if (first.own_attempt_status === "completed" && first.own_attempt_id) {
      resultRows = (
        await callFlashRead("get_my_survival_result", {
          target_attempt_id: first.own_attempt_id,
        })
      ).filter(isFlashResultRow);
    }
    const result = resultRows.length ? supabaseFlashQueries.toResult(resultRows) : undefined;
    const terminalReview =
      resultRows.length && first.own_attempt_id
        ? await this.getTerminalReview(first.own_attempt_id)
        : undefined;

    const challenge: ServerSurvivalChallenge = {
      id: first.publication_id,
      definitionId: first.challenge_slug,
      number: 1,
      title: first.challenge_title,
      subtitle: first.challenge_subtitle,
      description: first.challenge_description,
      mode: "survival",
      lives: first.initial_lives,
      slots: rows.map((row) => ({
        id: row.challenge_item_id,
        position: row.item_position,
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

export const supabaseSurvivalQueries = new SupabaseSurvivalQueries();
