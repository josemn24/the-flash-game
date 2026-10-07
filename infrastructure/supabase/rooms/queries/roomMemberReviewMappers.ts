import { resolveAvatarPath } from "@/infrastructure/supabase/assets/publicAvatar";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import { initials } from "@/lib/roomPresentation";
import type { RoomMemberDetailModel, RoomMemberReviewItem } from "@/types/view-models";
import type { RoomMemberReviewReadRow } from "./roomReadContracts";
import { toHistoricalFlashQuestion } from "./roomReviewQuestionMapper";
import { toHistoricalAnswerReview } from "./roomReviewResultMappers";

export function toRoomMemberReviewItems(rows: RoomMemberReviewReadRow[]): RoomMemberReviewItem[] {
  return rows
    .slice()
    .sort((left, right) => left.item_position - right.item_position)
    .map((row) => {
      const locked = row.challenge_mode === "pyramid" && !row.has_persisted_answer;
      const question = locked ? null : toHistoricalFlashQuestion(row);
      const result = locked ? null : toHistoricalAnswerReview(row);
      const status = locked ? "locked" : (result?.status ?? "unanswered");
      const metadata =
        row.challenge_mode === "pyramid"
          ? {
              levelId: row.level_id ?? undefined,
              label: row.level_label ?? undefined,
              briefing:
                row.briefing_title && row.briefing_format && row.briefing_description
                  ? {
                      title: row.briefing_title,
                      format: row.briefing_format,
                      description: row.briefing_description,
                    }
                  : undefined,
            }
          : row.challenge_mode === "alphabet"
            ? { alphabetLetter: row.alphabet_letter ?? undefined }
            : undefined;
      return {
        id: row.challenge_item_id,
        title:
          row.challenge_mode === "pyramid"
            ? (row.level_label ?? `Nivel ${row.item_position}`)
            : question
              ? QUESTION_FORMAT_LABELS[question.type]
              : row.question_type,
        subtitle:
          row.challenge_mode === "pyramid"
            ? (row.briefing_title ?? `Nivel ${row.item_position}`)
            : (question?.category ?? ""),
        question,
        result,
        status,
        ...(metadata ? { metadata } : {}),
      };
    });
}

export function toHistoricalMember(
  rows: RoomMemberReviewReadRow[],
  fallback: { id: string; name: string; avatarSrc?: string },
): RoomMemberDetailModel["member"] {
  const first = rows[0];
  const name = first?.display_name ?? fallback.name;
  const avatarSrc = resolveAvatarPath(first?.avatar_path) ?? fallback.avatarSrc;
  return {
    id: first?.player_id ?? fallback.id,
    name,
    initials: initials(name),
    avatarSrc: avatarSrc ?? undefined,
    totalFlashPoints: 0,
    challengeResults: {},
  };
}
