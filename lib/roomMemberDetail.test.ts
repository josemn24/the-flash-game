import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { getChallengeById } from "@/data/challenges";
import { buildMockRoomChallengeAttempt } from "@/lib/roomAttempts";
import {
  applyRoomMemberChallengeResult,
  buildRoomMemberDetailModel,
} from "@/lib/roomMemberDetail";

const now = new Date("2026-09-08T12:00:00.000Z");

describe("room member detail model", () => {
  it("can create a review fixture for every implemented room mode", () => {
    const challengeIds = [
      "tabarnia-flash-01",
      "tabarnia-challenge-02",
      "tabarnia-challenge-03",
      "tabarnia-challenge-04",
      "tabarnia-challenge-05",
    ];

    for (const challengeId of challengeIds) {
      const challenge = getChallengeById(challengeId);
      const attempt = buildMockRoomChallengeAttempt(challengeId, {
        points: 42,
        completed: true,
      });

      expect(challenge).toBeDefined();
      expect(attempt?.answers.length).toBeGreaterThan(0);
      expect(attempt?.answers.every((answer) => answer.questionId)).toBe(true);
    }
  });

  it("builds a completed player's attempt from the real daily challenge", () => {
    const model = buildRoomMemberDetailModel(demoRoom, "ches", now);

    expect(model?.dailyChallenge?.id).toBe("tabarnia-flash-01");
    expect(model?.member.name).toBe("Dark");
    expect(model?.result?.completed).toBe(true);
    expect(model?.result?.attempt?.answers.length).toBeGreaterThan(0);
    expect(model?.roomRank).toBe(1);
    expect(model?.dailyRank).toBe(1);
  });

  it("keeps pending players without an answer history", () => {
    const model = buildRoomMemberDetailModel(demoRoom, "laura", now);

    expect(model?.result?.completed).toBe(false);
    expect(model?.result?.attempt).toBeUndefined();
    expect(model?.dailyRank).toBeNull();
  });

  it("applies a session attempt without mutating the mock model", () => {
    const model = buildRoomMemberDetailModel(demoRoom, "player", now);
    if (!model) throw new Error("Expected player model");

    const updated = applyRoomMemberChallengeResult(model, {
      roomId: "tabarnia-room",
      challengeId: "tabarnia-flash-01",
      points: 88,
      completed: true,
      playedAt: "2026-09-08T16:00:00.000Z",
      answers: model.result?.attempt?.answers ?? [],
    });

    expect(updated.result?.attempt?.playedAt).toBe("2026-09-08T16:00:00.000Z");
    expect(updated.result?.points).toBe(88);
    expect(updated.member.totalPoints).toBe(182);
    expect(model.member.totalPoints).toBe(136);
    expect(demoRoom.members[0].totalPoints).toBe(136);
  });
});
