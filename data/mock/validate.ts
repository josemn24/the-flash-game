import { mockDomainStore, type MockDomainStore } from "@/data/mock/store";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function duplicateValues(values: readonly (number | string)[]) {
  const seen = new Set<number | string>();
  return values.filter((value) => (seen.has(value) ? true : !seen.add(value)));
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

export function validateMockDomainStore(store: MockDomainStore = mockDomainStore) {
  const errors: string[] = [];
  const collectionsWithIds = [
    store.players,
    store.rooms,
    store.roomMemberships,
    store.roomInvitations,
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
  if (duplicateValues(ids).length > 0) errors.push("Persisted IDs must be globally unique.");

  const playerIds = new Set(store.players.map(({ id }) => id));
  const roomIds = new Set(store.rooms.map(({ id }) => id));
  const seasonById = new Map(store.seasons.map((season) => [season.id, season]));
  const challengeDefinitionIds = new Set(store.challengeDefinitions.map(({ id }) => id));
  const challengeVersionById = new Map(
    store.challengeVersions.map((version) => [version.id, version]),
  );
  const questionDefinitionIds = new Set(store.questionDefinitions.map(({ id }) => id));
  const questionVersionIds = new Set(store.questionVersions.map(({ id }) => id));
  const scheduleById = new Map(
    store.scheduledChallenges.map((schedule) => [schedule.id, schedule]),
  );
  const attemptById = new Map(store.attempts.map((attempt) => [attempt.id, attempt]));
  const challengeItemById = new Map(store.challengeItems.map((item) => [item.id, item]));

  const authUserIds = store.players.flatMap(({ authUserId }) => (authUserId ? [authUserId] : []));
  if (duplicateValues(authUserIds).length > 0)
    errors.push("Player authUserId values must be unique.");
  for (const assignment of store.platformRoleAssignments) {
    if (!playerIds.has(assignment.playerId)) errors.push("A platform role references no player.");
  }
  const roleKeys = store.platformRoleAssignments.map(({ playerId, role }) => `${playerId}:${role}`);
  if (duplicateValues(roleKeys).length > 0)
    errors.push("Platform role assignments must be unique.");

  const membershipKeys = store.roomMemberships.map(
    ({ roomId, playerId }) => `${roomId}:${playerId}`,
  );
  if (duplicateValues(membershipKeys).length > 0) {
    errors.push("A player can only have one membership per room.");
  }
  for (const membership of store.roomMemberships) {
    if (!roomIds.has(membership.roomId) || !playerIds.has(membership.playerId)) {
      errors.push(`Broken membership ${membership.id}.`);
    }
    if (membership.endedAt !== null && membership.endedAt < membership.joinedAt) {
      errors.push(`Membership ${membership.id} ends before joining.`);
    }
    if (
      (membership.status === "active" && membership.endedAt !== null) ||
      (membership.status !== "active" && membership.endedAt === null)
    ) {
      errors.push(`Membership ${membership.id} has incoherent status and end date.`);
    }
  }

  const invitationTokens = store.roomInvitations.map(({ tokenHash }) => tokenHash);
  if (duplicateValues(invitationTokens).length > 0)
    errors.push("Invitation token hashes must be unique.");
  for (const invitation of store.roomInvitations) {
    if (!roomIds.has(invitation.roomId) || !playerIds.has(invitation.createdByPlayerId)) {
      errors.push(`Broken invitation ${invitation.id}.`);
    }
    if (!isNonNegativeInteger(invitation.useCount)) {
      errors.push(`Invitation ${invitation.id} has an invalid use count.`);
    }
    if (
      invitation.maxUses !== null &&
      (!isNonNegativeInteger(invitation.maxUses) || invitation.useCount > invitation.maxUses)
    ) {
      errors.push(`Invitation ${invitation.id} exceeds its usage limit.`);
    }
    if (invitation.expiresAt <= invitation.createdAt) {
      errors.push(`Invitation ${invitation.id} expires before it is created.`);
    }
  }

  for (const season of store.seasons) {
    if (!roomIds.has(season.roomId)) errors.push(`Broken season ${season.id}.`);
    if (season.startsAt >= season.endsAt) errors.push(`Season ${season.id} has an invalid window.`);
  }
  for (const room of store.rooms) {
    const activeMemberships = store.roomMemberships.filter(
      (membership) => membership.roomId === room.id && membership.status === "active",
    );
    if (activeMemberships.filter(({ role }) => role === "owner").length !== 1) {
      errors.push(`Room ${room.id} must have exactly one active owner.`);
    }
    if (
      store.seasons.filter((season) => season.roomId === room.id && season.status === "active")
        .length > 1
    ) {
      errors.push(`Room ${room.id} has multiple active seasons.`);
    }
  }

  if (duplicateValues(store.challengeDefinitions.map(({ slug }) => slug)).length > 0) {
    errors.push("Challenge slugs must be unique.");
  }
  if (duplicateValues(store.questionDefinitions.map(({ slug }) => slug)).length > 0) {
    errors.push("Question slugs must be unique.");
  }
  const validateVersions = <
    Version extends {
      id: string;
      versionNumber: number;
      status: string;
      publishedAt: string | null;
    },
  >(
    label: string,
    versions: readonly Version[],
    definitionIdOf: (version: Version) => string,
  ) => {
    const keys = versions.map((version) => `${definitionIdOf(version)}:${version.versionNumber}`);
    if (duplicateValues(keys).length > 0) errors.push(`${label} version numbers must be unique.`);
    for (const version of versions) {
      if (!Number.isInteger(version.versionNumber) || version.versionNumber < 1) {
        errors.push(`${label} version ${version.id} has an invalid number.`);
      }
      if (
        (version.status === "published" && version.publishedAt === null) ||
        (version.status === "draft" && version.publishedAt !== null)
      ) {
        errors.push(`${label} version ${version.id} has incoherent publication metadata.`);
      }
    }
  };
  validateVersions(
    "Challenge",
    store.challengeVersions,
    (version) => version.challengeDefinitionId,
  );
  validateVersions("Question", store.questionVersions, (version) => version.questionDefinitionId);

  for (const version of store.challengeVersions) {
    if (!challengeDefinitionIds.has(version.challengeDefinitionId)) {
      errors.push(`Broken challenge version ${version.id}.`);
    }
    if (!playerIds.has(version.createdByPlayerId)) {
      errors.push(`Challenge version ${version.id} has no creator.`);
    }
    const items = store.challengeItems
      .filter((item) => item.challengeVersionId === version.id)
      .sort((left, right) => left.position - right.position);
    if (items.some((item, index) => item.position !== index + 1)) {
      errors.push(`Challenge ${version.id} item positions must be contiguous from one.`);
    }
    if (items.some((item) => !isNonNegativeInteger(item.points))) {
      errors.push(`Challenge ${version.id} has invalid item points.`);
    }
    if (items.reduce((sum, item) => sum + item.points, 0) !== 100) {
      errors.push(`Challenge ${version.id} does not add up to 100 points.`);
    }
  }
  for (const definition of store.challengeDefinitions) {
    if (!playerIds.has(definition.createdByPlayerId)) {
      errors.push(`Challenge definition ${definition.id} has no creator.`);
    }
  }
  for (const definition of store.questionDefinitions) {
    if (!playerIds.has(definition.createdByPlayerId)) {
      errors.push(`Question definition ${definition.id} has no creator.`);
    }
  }
  for (const version of store.questionVersions) {
    if (!questionDefinitionIds.has(version.questionDefinitionId)) {
      errors.push(`Broken question version ${version.id}.`);
    }
    if (!playerIds.has(version.createdByPlayerId)) {
      errors.push(`Question version ${version.id} has no creator.`);
    }
  }
  for (const item of store.challengeItems) {
    if (
      !challengeVersionById.has(item.challengeVersionId) ||
      !questionVersionIds.has(item.questionVersionId)
    ) {
      errors.push(`Broken challenge item ${item.id}.`);
    }
  }

  for (const season of store.seasons) {
    const schedules = store.scheduledChallenges
      .filter((schedule) => schedule.seasonId === season.id)
      .sort((left, right) => left.opensAt.localeCompare(right.opensAt));
    const numbers = schedules.map(({ number }) => number);
    if (duplicateValues(numbers).length > 0)
      errors.push(`Season ${season.id} repeats a publication number.`);
    for (const schedule of schedules) {
      const version = challengeVersionById.get(schedule.challengeVersionId);
      if (!version || version.status !== "published") {
        errors.push(`Scheduled challenge ${schedule.id} must reference a published version.`);
      }
      if (!Number.isInteger(schedule.number) || schedule.number < 1) {
        errors.push(`Scheduled challenge ${schedule.id} has an invalid number.`);
      }
      if (
        schedule.opensAt >= schedule.closesAt ||
        schedule.opensAt < season.startsAt ||
        schedule.closesAt > season.endsAt
      ) {
        errors.push(`Scheduled challenge ${schedule.id} has an invalid window.`);
      }
      const cancelled = schedule.status === "cancelled";
      const closed = schedule.status === "closed";
      if (cancelled !== (schedule.cancelledAt !== null)) {
        errors.push(`Scheduled challenge ${schedule.id} has incoherent cancellation metadata.`);
      }
      if (closed !== (schedule.resultsLockedAt !== null)) {
        errors.push(`Scheduled challenge ${schedule.id} has incoherent result locking.`);
      }
      if (schedule.resultsLockedAt !== null && schedule.resultsLockedAt < schedule.closesAt) {
        errors.push(`Scheduled challenge ${schedule.id} locks results before closing.`);
      }
    }
    const liveSchedules = schedules.filter(({ status }) => status !== "cancelled");
    for (let index = 1; index < liveSchedules.length; index += 1) {
      if ((liveSchedules[index - 1]?.closesAt ?? "") > (liveSchedules[index]?.opensAt ?? "")) {
        errors.push(`Overlapping schedules in season ${season.id}.`);
      }
    }
  }
  for (const schedule of store.scheduledChallenges) {
    if (!seasonById.has(schedule.seasonId))
      errors.push(`Broken scheduled challenge ${schedule.id}.`);
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

  const attemptKeys = store.attempts.map(
    (attempt) => `${attempt.playerId}:${attempt.scheduledChallengeId}:${attempt.attemptNumber}`,
  );
  if (duplicateValues(attemptKeys).length > 0) {
    errors.push("Attempt numbers must be unique per player and publication.");
  }
  for (const attempt of store.attempts) {
    const schedule = scheduleById.get(attempt.scheduledChallengeId);
    if (!playerIds.has(attempt.playerId) || !schedule) errors.push(`Broken attempt ${attempt.id}.`);
    if (!Number.isInteger(attempt.attemptNumber) || attempt.attemptNumber < 1) {
      errors.push(`Attempt ${attempt.id} has an invalid number.`);
    }
    if (attempt.deadlineAt !== null && attempt.startedAt > attempt.deadlineAt) {
      errors.push(`Attempt ${attempt.id} has an invalid deadline.`);
    }
    if (attempt.completedAt !== null && attempt.completedAt < attempt.startedAt) {
      errors.push(`Attempt ${attempt.id} has invalid completion times.`);
    }
    if (
      (attempt.status === "completed" &&
        (attempt.completedAt === null || attempt.score === null)) ||
      (attempt.status === "in_progress" &&
        (attempt.completedAt !== null || attempt.score !== null)) ||
      (attempt.status === "abandoned" &&
        (attempt.completedAt === null || attempt.score !== null)) ||
      (attempt.status === "invalidated" && attempt.completedAt === null)
    ) {
      errors.push(`Attempt ${attempt.id} has incoherent status fields.`);
    }
    if (attempt.score !== null && (!isNonNegativeInteger(attempt.score) || attempt.score > 100)) {
      errors.push(`Attempt ${attempt.id} has an invalid score.`);
    }
    if (attempt.kind === "competitive" && schedule) {
      const season = seasonById.get(schedule.seasonId);
      const membership = store.roomMemberships.find(
        (candidate) =>
          candidate.roomId === season?.roomId && candidate.playerId === attempt.playerId,
      );
      if (
        schedule.status === "cancelled" ||
        !membership ||
        membership.role === "spectator" ||
        membership.joinedAt > attempt.startedAt ||
        (membership.endedAt !== null && membership.endedAt < attempt.startedAt)
      ) {
        errors.push(`Competitive attempt ${attempt.id} has no eligible membership at start.`);
      }
    }
  }

  const answerKeys = store.attemptAnswers.map(
    (answer) => `${answer.attemptId}:${answer.challengeItemId}`,
  );
  if (duplicateValues(answerKeys).length > 0) {
    errors.push("An attempt can only have one final answer per challenge item.");
  }
  const answerPointsByAttempt = new Map<string, number>();
  for (const answer of store.attemptAnswers) {
    const attempt = attemptById.get(answer.attemptId);
    const schedule = attempt ? scheduleById.get(attempt.scheduledChallengeId) : undefined;
    const item = challengeItemById.get(answer.challengeItemId);
    if (!attempt || !item) errors.push(`Broken attempt answer ${answer.id}.`);
    if (schedule && item && item.challengeVersionId !== schedule.challengeVersionId) {
      errors.push(`Answer ${answer.id} belongs to an item outside its attempted challenge.`);
    }
    if (!isNonNegativeInteger(answer.points) || (item && answer.points > item.points)) {
      errors.push(`Answer ${answer.id} exceeds its item points.`);
    }
    if (
      attempt &&
      (answer.presentedAt < attempt.startedAt ||
        (attempt.deadlineAt !== null && answer.presentedAt > attempt.deadlineAt))
    ) {
      errors.push(`Answer ${answer.id} was presented outside its attempt.`);
    }
    if (
      answer.submittedAt !== null &&
      (answer.submittedAt < answer.presentedAt ||
        (attempt?.deadlineAt != null && answer.submittedAt > attempt.deadlineAt))
    ) {
      errors.push(`Answer ${answer.id} was submitted outside its attempt.`);
    }
    if (
      ((answer.status === "timeout" || answer.status === "unanswered") &&
        answer.submittedAt !== null) ||
      ((answer.status === "correct" ||
        answer.status === "partial" ||
        answer.status === "incorrect") &&
        answer.submittedAt === null)
    ) {
      errors.push(`Answer ${answer.id} has incoherent submission metadata.`);
    }
    answerPointsByAttempt.set(
      answer.attemptId,
      (answerPointsByAttempt.get(answer.attemptId) ?? 0) + answer.points,
    );
  }
  for (const attempt of store.attempts) {
    if (attempt.status === "completed" && answerPointsByAttempt.get(attempt.id) !== attempt.score) {
      errors.push(`Attempt ${attempt.id} score differs from its answers.`);
    }
  }

  if (errors.length > 0) throw new Error(`Invalid mock domain store:\n- ${errors.join("\n- ")}`);
  return true;
}
