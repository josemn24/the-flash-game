-- PKs and UNIQUE constraints already supply B-tree indexes; do not duplicate them.
-- RLS: reverse membership lookup; listing active members and ownership invariants.
create index memberships_player_status_idx on public.room_memberships (player_id, status, room_id);
create index memberships_room_status_idx on public.room_memberships (room_id, status);
create unique index memberships_one_owner_idx on public.room_memberships (room_id)
  where role = 'owner' and status = 'active';
create index invitations_room_idx on private.room_invitations (room_id);
create index invitations_creator_idx on private.room_invitations (created_by_player_id);

-- Calendar, room history and the at-most-one-active-season invariant.
create unique index seasons_one_active_idx on public.seasons (room_id) where status = 'active';
create index seasons_room_start_idx on public.seasons (room_id, starts_at);
create index publications_season_window_idx on public.scheduled_challenges (season_id, opens_at, closes_at);
create index publications_version_idx on public.scheduled_challenges (challenge_version_id);

-- Reverse FK lookups for authoring, reuse and archival checks.
create index question_definitions_author_idx on private.question_definitions (created_by_player_id);
create index question_versions_author_idx on private.question_versions (created_by_player_id);
create index challenge_definitions_author_idx on private.challenge_definitions (created_by_player_id);
create index challenge_versions_author_idx on private.challenge_versions (created_by_player_id);
create index items_question_version_idx on private.challenge_items (question_version_id);

-- One official attempt even after abandonment/invalidation; history includes test attempts.
create unique index attempts_one_competitive_idx on public.attempts (player_id, scheduled_challenge_id)
  where kind = 'competitive';
create index attempts_publication_status_idx on public.attempts (scheduled_challenge_id, status);
create index attempts_publication_version_idx on public.attempts (scheduled_challenge_id, challenge_version_id);
create unique index sessions_one_unrevoked_idx on private.attempt_sessions (attempt_id)
  where revoked_at is null;
create index sessions_attempt_idx on private.attempt_sessions (attempt_id);
create index answers_attempt_time_idx on private.attempt_answers (attempt_id, submitted_at);
create index answers_item_version_idx on private.attempt_answers (challenge_item_id, challenge_version_id);

-- Ledger idempotency, per-attempt balance, season totals and audit lookups.
create unique index entries_one_accreditation_idx on private.flash_point_entries (attempt_id)
  where entry_type = 'accreditation';
create index entries_attempt_player_publication_idx
  on private.flash_point_entries (attempt_id, player_id, scheduled_challenge_id);
create index entries_publication_season_idx on private.flash_point_entries (scheduled_challenge_id, season_id);
create index entries_season_player_idx on private.flash_point_entries (season_id, player_id);
create index entries_creator_idx on private.flash_point_entries (created_by_player_id);
create index audit_entity_time_idx on private.audit_log (entity_type, entity_id, created_at);
create index audit_actor_time_idx on private.audit_log (actor_player_id, created_at);
-- No speculative JSONB GIN indexes: the initial queries use structured columns.

