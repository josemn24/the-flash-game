import { mockDomainStore, type MockDomainStore } from "@/data/mock/store";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function validateMockDomainStore(store: MockDomainStore = mockDomainStore) {
  const errors: string[] = [];
  const collectionsWithIds = [
    store.players,
    store.rooms,
    store.roomMemberships,
    store.seasons,
    store.challengeDefinitions,
    store.challengeVersions,
    store.challengeItems,
    store.questionDefinitions,
    store.questionVersions,
    store.scheduledChallenges,
    store.attempts,
    store.attemptAnswers,
  ] as const;
  const ids = collectionsWithIds.flatMap((collection) => collection.map((entity) => entity.id));
  if (ids.some((id) => !uuidPattern.test(id))) errors.push("Every persisted ID must be a UUID v5.");
  if (new Set(ids).size !== ids.length) errors.push("Persisted IDs must be globally unique.");

  const has = <T extends string>(values: readonly T[], value: T) => values.includes(value);
  const playerIds = store.players.map(({ id }) => id);
  const roomIds = store.rooms.map(({ id }) => id);
  const seasonIds = store.seasons.map(({ id }) => id);
  const challengeDefinitionIds = store.challengeDefinitions.map(({ id }) => id);
  const challengeVersionIds = store.challengeVersions.map(({ id }) => id);
  const questionDefinitionIds = store.questionDefinitions.map(({ id }) => id);
  const questionVersionIds = store.questionVersions.map(({ id }) => id);
  const scheduledChallengeIds = store.scheduledChallenges.map(({ id }) => id);
  const attemptIds = store.attempts.map(({ id }) => id);
  const challengeItemIds = store.challengeItems.map(({ id }) => id);
  const challengeItemById = new Map(store.challengeItems.map((item) => [item.id, item]));
  const scheduleById = new Map(
    store.scheduledChallenges.map((schedule) => [schedule.id, schedule]),
  );

  for (const membership of store.roomMemberships) {
    if (!has(roomIds, membership.roomId) || !has(playerIds, membership.playerId)) {
      errors.push(`Broken membership ${membership.id}.`);
    }
  }
  for (const season of store.seasons) {
    if (!has(roomIds, season.roomId)) errors.push(`Broken season ${season.id}.`);
  }
  for (const version of store.challengeVersions) {
    if (!has(challengeDefinitionIds, version.challengeDefinitionId)) {
      errors.push(`Broken challenge version ${version.id}.`);
    }
  }
  for (const version of store.questionVersions) {
    if (!has(questionDefinitionIds, version.questionDefinitionId)) {
      errors.push(`Broken question version ${version.id}.`);
    }
  }
  for (const item of store.challengeItems) {
    if (
      !has(challengeVersionIds, item.challengeVersionId) ||
      !has(questionVersionIds, item.questionVersionId)
    ) {
      errors.push(`Broken challenge item ${item.id}.`);
    }
  }
  for (const schedule of store.scheduledChallenges) {
    if (
      !has(seasonIds, schedule.seasonId) ||
      !has(challengeVersionIds, schedule.challengeVersionId)
    ) {
      errors.push(`Broken scheduled challenge ${schedule.id}.`);
    }
    const version = store.challengeVersions.find(({ id }) => id === schedule.challengeVersionId);
    if (version?.status !== "published") {
      errors.push(`Scheduled challenge ${schedule.id} must reference a published version.`);
    }
  }
  for (const attempt of store.attempts) {
    if (
      !has(playerIds, attempt.playerId) ||
      !has(scheduledChallengeIds, attempt.scheduledChallengeId)
    ) {
      errors.push(`Broken attempt ${attempt.id}.`);
    }
  }
  for (const answer of store.attemptAnswers) {
    if (!has(attemptIds, answer.attemptId) || !has(challengeItemIds, answer.challengeItemId)) {
      errors.push(`Broken attempt answer ${answer.id}.`);
    }
    const attempt = store.attempts.find(({ id }) => id === answer.attemptId);
    const schedule = attempt ? scheduleById.get(attempt.scheduledChallengeId) : undefined;
    const item = challengeItemById.get(answer.challengeItemId);
    if (schedule && item && item.challengeVersionId !== schedule.challengeVersionId) {
      errors.push(`Answer ${answer.id} belongs to an item outside its attempted challenge.`);
    }
  }

  const officialAttemptKeys = store.attempts
    .filter((attempt) => attempt.kind === "competitive")
    .map(
      (attempt) => `${attempt.playerId}:${attempt.scheduledChallengeId}:${attempt.attemptNumber}`,
    );
  if (new Set(officialAttemptKeys).size !== officialAttemptKeys.length) {
    errors.push("Competitive attempt numbers must be unique per player and publication.");
  }
  const answerKeys = store.attemptAnswers.map(
    (answer) => `${answer.attemptId}:${answer.challengeItemId}`,
  );
  if (new Set(answerKeys).size !== answerKeys.length) {
    errors.push("An attempt can only have one final answer per challenge item.");
  }

  const superadminIds = new Set(
    store.platformRoleAssignments
      .filter(({ role }) => role === "superadmin")
      .map(({ playerId }) => playerId),
  );
  if (
    store.roomMemberships.some((membership) => superadminIds.has(membership.playerId)) ||
    store.attempts.some(
      (attempt) => superadminIds.has(attempt.playerId) && attempt.kind === "competitive",
    )
  ) {
    errors.push("Superadmins must remain ghosts without membership or competitive attempts.");
  }

  for (const room of store.rooms) {
    const owners = store.roomMemberships.filter(
      (membership) =>
        membership.roomId === room.id &&
        membership.status === "active" &&
        membership.role === "owner",
    );
    if (owners.length !== 1) errors.push(`Room ${room.id} must have exactly one active owner.`);
    const activeSeasons = store.seasons.filter(
      (season) => season.roomId === room.id && season.status === "active",
    );
    if (activeSeasons.length > 1) errors.push(`Room ${room.id} has multiple active seasons.`);
  }

  for (const version of store.challengeVersions) {
    const items = store.challengeItems.filter((item) => item.challengeVersionId === version.id);
    const positions = items.map((item) => item.position);
    if (new Set(positions).size !== positions.length)
      errors.push(`Duplicate item position in ${version.id}.`);
    if (items.reduce((sum, item) => sum + item.points, 0) !== 100) {
      errors.push(`Challenge ${version.id} does not add up to 100 points.`);
    }
  }

  for (const season of store.seasons) {
    const schedules = store.scheduledChallenges
      .filter((schedule) => schedule.seasonId === season.id && schedule.status !== "cancelled")
      .sort((left, right) => left.opensAt.localeCompare(right.opensAt));
    for (let index = 1; index < schedules.length; index += 1) {
      if ((schedules[index - 1]?.closesAt ?? "") > (schedules[index]?.opensAt ?? "")) {
        errors.push(`Overlapping schedules in season ${season.id}.`);
      }
    }
  }

  const attemptAnswersByAttempt = new Map<string, number>();
  for (const answer of store.attemptAnswers) {
    attemptAnswersByAttempt.set(
      answer.attemptId,
      (attemptAnswersByAttempt.get(answer.attemptId) ?? 0) + answer.points,
    );
  }
  for (const attempt of store.attempts) {
    if (
      attempt.status === "completed" &&
      attemptAnswersByAttempt.get(attempt.id) !== attempt.score
    ) {
      errors.push(`Attempt ${attempt.id} score differs from its answers.`);
    }
  }

  if (errors.length > 0) throw new Error(`Invalid mock domain store:\n- ${errors.join("\n- ")}`);
  return true;
}
