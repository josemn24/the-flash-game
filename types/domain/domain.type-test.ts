import type {
  AnswerStatus,
  Attempt,
  AttemptKind,
  AttemptOutcome,
  AttemptStatus,
  ContentStatus,
  MembershipStatus,
  Player,
  PlayerId,
  PlayerStatus,
  PublicationStatus,
  Room,
  RoomId,
  RoomRole,
  RoomStatus,
  Season,
  SeasonStatus,
} from "@/types/domain";

type Assert<Value extends true> = Value;
type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type HasNoKey<Value, Key extends PropertyKey> = Key extends keyof Value ? false : true;

type PlayerIdIsNotRoomId = Assert<PlayerId extends RoomId ? false : true>;
type RoomIdIsNotPlayerId = Assert<RoomId extends PlayerId ? false : true>;
type PlainStringIsNotAnId = Assert<string extends PlayerId ? false : true>;

type PlayerIsReadonly = Assert<IsEqual<Pick<Player, "id">, Readonly<Pick<Player, "id">>>>;
type RoomIsReadonly = Assert<IsEqual<Pick<Room, "title">, Readonly<Pick<Room, "title">>>>;
type SeasonIsReadonly = Assert<IsEqual<Pick<Season, "roomId">, Readonly<Pick<Season, "roomId">>>>;
type AttemptIsReadonly = Assert<IsEqual<Attempt, Readonly<Attempt>>>;

type RoomHasNoCurrentUser = Assert<HasNoKey<Room, "currentUserId">>;
type RoomHasNoMembers = Assert<HasNoKey<Room, "members">>;
type RoomHasNoRankings = Assert<HasNoKey<Room, "rankings">>;
type RoomHasNoTotals = Assert<HasNoKey<Room, "totalPoints">>;
type SeasonHasNoChallenges = Assert<HasNoKey<Season, "scheduledChallenges">>;

type PlayerStatesAreExhaustive = Assert<IsEqual<PlayerStatus, "active" | "anonymized">>;
type RoomStatesAreExhaustive = Assert<IsEqual<RoomStatus, "active" | "deleted">>;
type RolesAreExhaustive = Assert<IsEqual<RoomRole, "owner" | "admin" | "member" | "spectator">>;
type SuperadminIsNotARoomRole = Assert<"superadmin" extends RoomRole ? false : true>;
type MembershipStatesAreExhaustive = Assert<
  IsEqual<MembershipStatus, "active" | "left" | "removed" | "banned">
>;
type SeasonStatesAreExhaustive = Assert<
  IsEqual<SeasonStatus, "draft" | "scheduled" | "active" | "finished" | "cancelled">
>;
type ContentStatesAreExhaustive = Assert<
  IsEqual<ContentStatus, "draft" | "published" | "archived">
>;
type PublicationStatesAreExhaustive = Assert<
  IsEqual<PublicationStatus, "scheduled" | "open" | "closed" | "cancelled">
>;
type AttemptStatesAreExhaustive = Assert<
  IsEqual<AttemptStatus, "in_progress" | "completed" | "abandoned" | "expired" | "invalidated">
>;
type AttemptOutcomesAreExhaustive = Assert<IsEqual<AttemptOutcome, "passed" | "failed" | null>>;
type AnswerStatesAreExhaustive = Assert<
  IsEqual<AnswerStatus, "correct" | "partial" | "incorrect" | "unanswered" | "timeout">
>;
type AttemptKindsAreExhaustive = Assert<IsEqual<AttemptKind, "competitive" | "test">>;

export type DomainTypeAssertions =
  | PlayerIdIsNotRoomId
  | RoomIdIsNotPlayerId
  | PlainStringIsNotAnId
  | PlayerIsReadonly
  | RoomIsReadonly
  | SeasonIsReadonly
  | AttemptIsReadonly
  | RoomHasNoCurrentUser
  | RoomHasNoMembers
  | RoomHasNoRankings
  | RoomHasNoTotals
  | SeasonHasNoChallenges
  | PlayerStatesAreExhaustive
  | RoomStatesAreExhaustive
  | RolesAreExhaustive
  | SuperadminIsNotARoomRole
  | MembershipStatesAreExhaustive
  | SeasonStatesAreExhaustive
  | ContentStatesAreExhaustive
  | PublicationStatesAreExhaustive
  | AttemptStatesAreExhaustive
  | AttemptOutcomesAreExhaustive
  | AnswerStatesAreExhaustive
  | AttemptKindsAreExhaustive;
