import "server-only";

import type { PrivateQuestionAssetResolver } from "@/application/ports/private-question-assets";
import type { RoomMemberDetailQueries } from "@/application/queries";
import { supabasePrivateQuestionAssetResolver } from "@/infrastructure/supabase/assets/privateQuestionAssetResolver";
import { createClient } from "@/lib/supabase/server";
import type {
  QueryContext,
  RoomDailyLeaderboardEntry,
  RoomMemberDetailModel,
} from "@/types/view-models";
import { resolveAvatarPath } from "@/lib/media/publicAvatar";
import type { AttemptExpirationQueries } from "@/infrastructure/supabase/attempts/attemptExpiration";
import type { RoomHistoryReadRow, RoomReadRow } from "./roomReadContracts";
import {
  isChallengeRankingReadRow,
  isRecord,
  isRoomHistoryReadRow,
  isRoomMemberReviewReadRow,
  isSeasonRankingReadRow,
} from "./roomReadGuards";
import { callHistoryRead, callRankingRead, callRoomRead } from "./roomReadRpc";
import {
  currentMemberChallengeSummary,
  historicalChallengeSummary,
  toHistoricalChallenge,
  toHistoricalMember,
  toHistoricalResult,
  toRoomMemberReviewItems,
  toRoomMemberReviewProgress,
  toHistoricalLeaderboard,
} from "./roomHistoryMappers";
import { toChallengeLeaderboard, toSeasonLeaderboard } from "./roomViewMappers";

export class SupabaseRoomMemberDetailQueries implements RoomMemberDetailQueries {
  constructor(
    private readonly attemptExpiration: AttemptExpirationQueries,
    private readonly privateQuestionAssets: PrivateQuestionAssetResolver = supabasePrivateQuestionAssetResolver,
  ) {}

  async getMemberDetail(
    roomKey: string,
    memberKey: string,
    context: QueryContext,
    publicationKey?: string,
  ): Promise<RoomMemberDetailModel | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(memberKey)) return null;

    let historyRow: RoomHistoryReadRow | undefined;
    let currentRoomRow: RoomReadRow | undefined;
    let challengeLeaderboard: RoomDailyLeaderboardEntry[] = [];
    let challengeSummary: RoomMemberDetailModel["challengeSummary"] = null;
    let resolvedPublicationId: string | undefined = publicationKey;
    let seasonId: string | undefined;

    if (publicationKey) {
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(publicationKey)) return null;
      const rows = await callHistoryRead(
        "get_room_history",
        { target_room_slug: roomKey, target_publication_id: publicationKey },
        isRoomHistoryReadRow,
        this.attemptExpiration,
      );
      historyRow = rows[0];
      if (!historyRow) return null;
      seasonId = historyRow.season_id;
      challengeSummary = historicalChallengeSummary(historyRow);
      challengeLeaderboard = toHistoricalLeaderboard(rows);
    } else {
      const roomRows = await callRoomRead("get_room_detail", { target_room_slug: roomKey });
      currentRoomRow = roomRows[0];
      if (!currentRoomRow?.publication_id || !currentRoomRow.season_id) return null;
      resolvedPublicationId = currentRoomRow.publication_id;
      seasonId = currentRoomRow.season_id;
      challengeSummary = currentMemberChallengeSummary(currentRoomRow);
      if (!challengeSummary) return null;
    }

    if (!resolvedPublicationId || !seasonId) return null;
    const viewerRole = historyRow?.viewer_role ?? currentRoomRow?.membership_role;
    if (viewerRole === "spectator") return null;
    const [initialReviewRows, seasonRows, rankingRows] = await Promise.all([
      callHistoryRead(
        "get_room_member_review",
        {
          target_room_slug: roomKey,
          target_publication_id: resolvedPublicationId,
          target_player_id: memberKey,
        },
        isRoomMemberReviewReadRow,
        this.attemptExpiration,
      ),
      callRankingRead("get_season_ranking", { target_season_id: seasonId }, isSeasonRankingReadRow),
      historyRow
        ? Promise.resolve(challengeLeaderboard)
        : callRankingRead(
            "get_challenge_ranking",
            { target_publication_id: resolvedPublicationId },
            isChallengeRankingReadRow,
          ).then(toChallengeLeaderboard),
    ]);
    let reviewRows = initialReviewRows;
    const reviewNeedsPrivateAsset = reviewRows.some((row) => {
      if (!isRecord(row.public_payload)) return false;
      const media = row.public_payload.media;
      const surface = row.public_payload.surface;
      return (
        (isRecord(media) && typeof media.assetId === "string") ||
        (isRecord(surface) && typeof surface.assetId === "string")
      );
    });
    if (reviewNeedsPrivateAsset && memberKey === context.viewer.playerId) {
      const authClient = await createClient();
      const { data: authData } = await authClient.auth.getUser();
      if (authData.user) {
        reviewRows = await Promise.all(
          reviewRows.map(async (row) => ({
            ...row,
            public_payload: await this.privateQuestionAssets.resolve({
              authUserId: authData.user!.id,
              attemptId: row.attempt_id,
              publicPayload: row.public_payload,
            }),
          })),
        );
      }
    }
    if (!historyRow) challengeLeaderboard = rankingRows;

    const seasonEntry = seasonRows.find((entry) => entry.player_id === memberKey);
    const reviewMember = reviewRows[0];
    if (!reviewMember && !seasonEntry) return null;
    const member = toHistoricalMember(reviewRows, {
      id: memberKey,
      name: seasonEntry?.display_name ?? context.viewer.name,
      avatarSrc: resolveAvatarPath(seasonEntry?.avatar_path) ?? context.viewer.avatarSrc,
    });
    member.totalFlashPoints = seasonEntry?.flash_points ?? 0;
    const roomLeaderboard = toSeasonLeaderboard(seasonRows);
    const challenge =
      reviewRows.length && reviewRows[0]?.challenge_mode !== "pyramid"
        ? toHistoricalChallenge(reviewRows)
        : null;
    const result = reviewRows.length ? toHistoricalResult(reviewRows) : null;
    const resolvedViewerRole = reviewMember?.viewer_role ?? viewerRole;
    return {
      roomId: roomKey,
      roomTitle:
        reviewMember?.room_title ?? historyRow?.room_title ?? currentRoomRow?.room_title ?? "",
      member,
      challengeSummary,
      challenge,
      result,
      reviewItems: reviewRows.length ? toRoomMemberReviewItems(reviewRows) : [],
      reviewProgress: reviewRows.length ? toRoomMemberReviewProgress(reviewRows) : null,
      roomRank: seasonEntry?.position ?? 0,
      challengeRank:
        challengeLeaderboard.find(({ memberId }) => memberId === memberKey)?.rank ?? null,
      roomLeaderboard,
      challengeLeaderboard,
      returnHref: historyRow
        ? `/salas/${roomKey}/historial/${resolvedPublicationId}`
        : `/salas/${roomKey}/ranking`,
      source: "supabase",
      canReviewMembers: resolvedViewerRole !== "spectator",
    };
  }
}
