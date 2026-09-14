declare const brand: unique symbol;

export type Brand<Value, Name extends string> = Value & {
  readonly [brand]: Name;
};

type EntityId<Name extends string> = Brand<string, Name>;

export type PlayerId = EntityId<"PlayerId">;
export type AuthUserId = EntityId<"AuthUserId">;
export type RoomId = EntityId<"RoomId">;
export type RoomMembershipId = EntityId<"RoomMembershipId">;
export type RoomInvitationId = EntityId<"RoomInvitationId">;
export type SeasonId = EntityId<"SeasonId">;
export type ChallengeDefinitionId = EntityId<"ChallengeDefinitionId">;
export type ChallengeVersionId = EntityId<"ChallengeVersionId">;
export type ChallengeItemId = EntityId<"ChallengeItemId">;
export type QuestionDefinitionId = EntityId<"QuestionDefinitionId">;
export type QuestionVersionId = EntityId<"QuestionVersionId">;
export type ScheduledChallengeId = EntityId<"ScheduledChallengeId">;
export type AttemptId = EntityId<"AttemptId">;
export type AttemptAnswerId = EntityId<"AttemptAnswerId">;

export type AttemptSessionId = EntityId<"AttemptSessionId">;
export type AnswerReceiptId = EntityId<"AnswerReceiptId">;
