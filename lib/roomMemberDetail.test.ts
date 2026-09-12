import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { getChallengeById } from "@/data/challenges";
import { isAnswerCorrect } from "@/lib/scoring";
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

  it("keeps mock answer states and points coherent for every completed result", () => {
    for (const member of demoRoom.members) {
      const resultPoints = Object.values(member.challengeResults).reduce(
        (total, result) => total + result.points,
        0,
      );
      expect(resultPoints).toBe(member.totalPoints);

      for (const [challengeId, result] of Object.entries(member.challengeResults)) {
        if (!result.completed) continue;
        const challenge = getChallengeById(challengeId);
        if (!challenge) throw new Error(`Expected challenge ${challengeId}`);
        const attempt = buildMockRoomChallengeAttempt(challengeId, result, { seed: member.id });
        if (!attempt) throw new Error(`Expected attempt for ${member.id}/${challengeId}`);

        const expectedAnswerCount = challenge.mode === "alphabet"
          ? challenge.entries.length
          : challenge.mode === "narrative"
            ? challenge.beats.flatMap((beat) => beat.steps.filter((step) => step.type === "question")).length
            : challenge.mode === "pyramid"
              ? challenge.levels.length
              : challenge.questions.length;
        expect(attempt.answers).toHaveLength(expectedAnswerCount);
        expect(attempt.answers.reduce((total, answer) => total + (answer.points ?? 0), 0)).toBe(result.points);
        expect(new Set(attempt.answers.map((answer) => answer.status))).toEqual(
          new Set(["correct", "incorrect", "unanswered"]),
        );

        for (const answer of attempt.answers) {
          const question = challenge.mode === "alphabet"
            ? challenge.entries.find((entry) => entry.question.id === answer.questionId)?.question
            : challenge.mode === "narrative"
              ? challenge.beats
                .flatMap((beat) => beat.steps)
                .find((step) => step.type === "question" && step.question.id === answer.questionId)?.question
              : challenge.mode === "pyramid"
                ? challenge.levels.find((level) => level.question.id === answer.questionId)?.question
                : challenge.questions.find((candidate) => candidate.id === answer.questionId);
          if (!question) throw new Error(`Expected question ${answer.questionId}`);
          expect(isAnswerCorrect(question, answer.answer as NonNullable<typeof answer.answer>)).toBe(answer.isCorrect);

          if (answer.status === "correct") {
            expect(answer.isCorrect).toBe(true);
            expect(answer.points).toBeGreaterThan(0);
          } else {
            expect(answer.isCorrect).toBe(false);
            expect(answer.points ?? 0).toBe(0);
          }
        }
      }
    }
  });

  it("does not collapse Rielbe's Steel Ball Run score into the first answer", () => {
    const member = demoRoom.members.find((candidate) => candidate.id === "alex");
    if (!member) throw new Error("Expected Rielbe");
    const result = member.challengeResults["tabarnia-flash-01"];
    const attempt = buildMockRoomChallengeAttempt("tabarnia-flash-01", result, { seed: member.id });
    if (!attempt) throw new Error("Expected Rielbe attempt");

    expect(attempt.answers.filter((answer) => (answer.points ?? 0) > 0).length).toBeGreaterThan(1);
    expect(attempt.answers.map((answer) => answer.points)).not.toEqual([
      result.points,
      ...Array(attempt.answers.length - 1).fill(0),
    ]);
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
